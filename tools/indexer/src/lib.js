const fs = require('fs-extra');
const path = require('path');
const {flattenDeep} = require('lodash');
const {Client} = require('@elastic/elasticsearch');
const walk = require('walk');
const log = require('ulog')('indexer');
const {pathExists, readJson} = require('fs-extra');
const CRATE_TOOLS = require(`../../../ro-crate-tools`);
const {Parser} = require('@coedl/transcription-parsers');
const indexerMetadataNamespace = 'ocfl-indexer:meta';

module.exports = {
    createWalker,
    createIndicesAndLoadMappings,
};

async function createWalker({paths, idx}) {
    const args = paths[0].args;
    log.level = log[args.logLevel.toUpperCase()];

    const elasticClient = new Client({
        node: args.search,
        auth: {
            username: args.username,
            password: args.password,
        },
    });
    const ocflRoot = args.source;
    for (let p of paths) {
        const folder = p.folder;
        log.info(`Walking '${folder}'`);
        await new Promise(async (resolve) => {
            let walker = walk.walk(folder, {});

            walker.on('file', async (root, fileStats, next) => {
                switch (fileStats.name) {
                    case '0=ocfl_object_1.0':
                        try {
                            const crateTools = await indexOcflObject({
                                elasticClient,
                                root,
                                ocflRoot,
                            });
                            const state = (await crateTools.getLatestVersion())
                                .state;
                            indexTranscriptions({
                                elasticClient,
                                objectifiedCrate: crateTools.objectifiedCrate,
                                root,
                                state,
                            });
                        } catch (error) {
                            console.log(error);
                            log.error(
                                `Crate at ${root} has an issue: ${error.message}`
                            );
                        }
                        break;
                }
                next();
            });

            walker.on('errors', (root, nodeStatsArray, next) => {
                next();
            });

            walker.on('end', () => {
                resolve();
            });
        });
    }
    return;
}

async function createIndexAndLoadMapping({elasticClient, index}) {
    let mappings;
    let mappingFile = path.join(
        __dirname,
        '../mappings',
        index,
        'mappings.json'
    );
    if (await pathExists(mappingFile)) {
        mappings = await readJson(mappingFile);
    } else {
        mappingFile = path.join(__dirname, '../mappings/mappings.json');
        mappings = await readJson(mappingFile);
    }
    try {
        await elasticClient.indices.get({index});
    } catch (error) {
        try {
            await elasticClient.indices.create({index});
        } catch (error) {
            throw new Error(error.meta.body.error.reason);
        }
        try {
            await elasticClient.indices.putMapping({
                index,
                body: mappings.mappings,
            });
        } catch (error) {
            throw new Error(error.meta.body.error.reason);
        }
    }
}

function removeContext({data}) {
    delete data['@context'];
    return data;
}

async function createIndicesAndLoadMappings({args}) {
    let contents = await fs.readdir(path.join(__dirname, '../mappings'));
    let domains = ['default'];
    for (let item of contents) {
        let stat = await fs.stat(path.join(__dirname, '../mappings', item));
        if (stat.isDirectory()) {
            domains.push(item);
        }
    }

    const elasticClient = new Client({
        node: args.search,
        auth: {
            username: args.username,
            password: args.password,
        },
    });
    let mappings;

    for (let index of domains) {
        await createIndexAndLoadMapping({elasticClient, index});
    }
}

async function indexOcflObject({elasticClient, root, ocflRoot}) {
    log.debug(`Processing crate at: `, root);
    const objectPath = root.replace(ocflRoot, '');
    const crateTools = new CRATE_TOOLS({
        ocflRoot: ocflRoot,
        objectPath: objectPath,
    });
    // load the latest crate
    let {flattenedCrate, objectifiedCrate} = await crateTools.loadLatestCrate();

    // validate it
    const {valid, domain} = await crateTools.validate({});
    if (!valid) {
        throw new Error(`Crate @ ${root} is not valid. Skipping it!`);
    }

    objectifiedCrate = await crateTools.compact();
    // console.log(
    //     JSON.stringify(objectifiedCrate, null, 2)
    // );

    // run it through any domain transformers
    let transformerPath = path.join(
        __dirname,
        '../transformers/',
        domain,
        'index.js'
    );
    if (await pathExists(transformerPath)) {
        const {transformer} = require(transformerPath);
        objectifiedCrate = transformer({
            data: objectifiedCrate,
        });
    }

    // create the index if required and load the domain specific mapping if there is one
    log.debug(`Setting up index for: `, domain);
    await createIndexAndLoadMapping({
        elasticClient,
        index: domain,
    });

    // and finally - index the document
    log.debug(`Indexing document at path: `, root);
    await indexDocument({
        elasticClient,
        index: domain,
        data: objectifiedCrate,
    });
    return crateTools;
}

async function indexDocument({elasticClient, data, index}) {
    data = removeContext({data});
    data[`${indexerMetadataNamespace}:type`] = 'document';
    let id = data.identifier.filter((d) => d.name === 'hashId')[0].value;
    // console.info(` as ${index}/${id}`);
    try {
        await elasticClient.index({id, index, body: data});
    } catch (error) {
        throw new Error(error.meta.body.error.reason);
    }
}

async function indexTranscriptions({
    elasticClient,
    objectifiedCrate,
    root,
    state,
}) {
    const transcriptionExtensions = ['eaf', 'trs', 'ixt', 'flextext'];
    const objectId = objectifiedCrate.identifier.filter(
        (i) => i.name && i.name[0] === 'id'
    )[0].value[0];
    const hashId = objectifiedCrate.identifier.filter(
        (i) => i.name && i.name[0] === 'hashId'
    )[0].value[0];
    const domain = objectifiedCrate.identifier.filter(
        (i) => i.name && i.name[0] === 'domain'
    )[0].value[0];

    let result, segments;
    for (let file of Object.keys(state)) {
        const extension = file.split('.').pop();
        if (transcriptionExtensions.includes(extension)) {
            file = state[file].pop();
            log.debug(`Processing transcription ${root}/${file.path}`);
            try {
                result = await parseTranscription({root, file});

                switch (extension) {
                    case 'eaf':
                        segments = extractEAFSegments({result});
                        break;
                    case 'trs':
                        segments = extractTRSSegments({result});
                        break;
                    case 'ixt':
                        segments = extractIXTSegments({result});
                        break;
                    case 'flextext':
                        segments = extractFlextextSegments({result});
                        break;
                }

                segments = segments.map((s) => {
                    return {
                        ...s,
                        identifier: objectId,
                        file: file.path.split('/').pop(),
                    };
                });
                let docs = segments.map((segment) => {
                    return {
                        identifier: `${hashId}-${file.path.split('/').pop()}-${
                            segment.timeBegin
                        }`,
                        segment,
                    };
                });
                for (let doc of docs) {
                    await indexSegment({elasticClient, domain, doc});
                }
            } catch (error) {
                console.log(
                    `ERROR: processing transcription: ${error.message} ${root}/${file.path}`
                );
            }
        }

        async function parseTranscription({root, file}) {
            let xmlString = await fs.readFile(
                path.join(root, file.path),
                'utf-8'
            );
            let parser = new Parser({
                name: file.path,
                data: xmlString,
            });
            return await parser.parse();
        }

        function extractEAFSegments({result}) {
            let segments = result.timeslots.children.map((timeslot) => {
                return timeslot.children.map((annotation) => {
                    let text = `${annotation.value} ${annotation.children
                        .map((c) => c.value)
                        .join(' ')}`;

                    return {
                        text,
                        timeBegin: annotation.time.begin,
                        timeEnd: annotation.time.end,
                    };
                });
            });
            segments = flattenDeep(segments);
            return segments;
        }

        function extractTRSSegments({result}) {
            let segments = result.segments.episodes.map((episode) => {
                return episode.sections.map((section) => {
                    return section.turns.map((turn) => {
                        return {
                            text: turn.text,
                            timeBegin: turn.time.begin,
                            timeEnd: turn.time.end,
                        };
                    });
                });
            });
            segments = flattenDeep(segments);
            return segments;
        }

        function extractIXTSegments({result}) {
            let segments = result.segments.phrases.map((phrase) => {
                let text = [
                    phrase.transcription,
                    phrase.translation,
                    ...phrase.words.map((w) => {
                        return w.morphemes.map((m) => m.text);
                    }),
                ];
                text = flattenDeep(text);
                return {
                    text: text.join(' '),
                    timeBegin: phrase.time.begin,
                    timeEnd: phrase.time.end,
                };
            });
            segments = flattenDeep(segments);
            return segments;
        }

        function extractFlextextSegments({result}) {
            let segments = result.segments.paragraphs.map((paragraph) => {
                return paragraph.phrases.map((phrase) => {
                    let text = [
                        phrase.transcription.text,
                        phrase.translation.text,
                        ...phrase.words.map((word) =>
                            word.morphemes.map((m) => m.text)
                        ),
                    ];
                    text = flattenDeep(text);
                    return {
                        text: text.join(' '),
                        timeBegin: phrase.time.begin,
                        timeEnd: phrase.time.end,
                    };
                });
            });
            segments = flattenDeep(segments);
            return segments;
        }
    }
}

async function indexSegment({elasticClient, domain, doc}) {
    try {
        await elasticClient.index({
            id: doc.identifier,
            index: domain,
            body: {
                [`${indexerMetadataNamespace}:type`]: 'segment',
                segment: doc.segment,
            },
        });
    } catch (error) {
        throw new Error(error.meta.body.error.reason);
    }
}

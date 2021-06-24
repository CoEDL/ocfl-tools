const {readJSON, stat, readFile} = require('fs-extra');
const {basename, join} = require('path');
const {flattenDeep, isArray, intersection} = require('lodash');
const {Client} = require('@elastic/elasticsearch');
const walk = require('walk');
const log = require('ulog')('indexer');
const {pathExists, readJson} = require('fs-extra');
// const CRATE_TOOLS = require(`../../../ro-crate-tools`);
const {ROCrate} = require('ro-crate');
const {Parser} = require('@coedl/transcription-parsers');
const indexerMetadataNamespace = 'ocfl-indexer:meta';
const {Repository} = require('@coedl/ocfl');

const ignorePropertyResolution = ['@type', 'hasMember', 'memberOf'];
const roCrateMetadataFile = [
    'ro-crate-metadata.json',
    'ro-crate-metadata.jsonld',
];

module.exports = {
    getDomainIdentifier,
    getElasticClient,
    createIndexAndLoadMapping,
    indexDocument,
    createWalker,
    processOcflObject,
};

function getDomainIdentifier(crate) {
    let rootDataset = crate.getRootDataset();
    if (!rootDataset.identifier) {
        throw new Error(
            `Root dataset does not have an 'identifier' property so I'm unable to idenfiy this crate.`
        );
    }
    rootDataset.identifer = flattenDeep([rootDataset.identifier]);
    rootDataset.identifier = rootDataset.identifier.map((item) => {
        return crate.getItem(item['@id']);
    });
    const domain = rootDataset.identifier.filter((i) => i.name === 'domain')[0]
        .value;
    if (!domain) {
        throw new Error(`Unable to identify the 'domain' of this data.`);
    }
    const id = rootDataset.identifier.filter((i) => i.name === 'id')[0].value;
    if (!id) {
        throw new Error(`Unable to identify the 'id' of this data.`);
    }
    const hashId = rootDataset.identifier.filter((i) => i.name === 'hashId')[0]
        .value;
    if (!hashId) {
        throw new Error(`Unable to identify the 'hashId' of this data.`);
    }
    return {id, hashId, domain};
}

async function getElasticClient({host, username, password}) {
    return await new Client({
        node: host,
        auth: {
            username,
            password,
        },
    });
}

async function createWalker({paths, idx}) {
    const configuration = paths[0].configuration;
    const log = paths[0].log;

    const repository = new Repository({
        ocflRoot: configuration.ocfl.repository,
        ocflScratch: configuration.ocfl.scratch,
    });

    for (let p of paths) {
        const folder = p.folder;
        log.info(`Walking '${folder}'`);
        await new Promise(async (resolve) => {
            let walker = walk.walk(folder, {});

            walker.on('file', async (root, fileStats, next) => {
                switch (fileStats.name) {
                    case '0=ocfl_object_1.0':
                        const id = root
                            .replace(p.configuration.ocfl.repository, '')
                            .replace(/\//g, '');

                        try {
                            // try to load ocfl object
                            let object = repository.object({id});

                            if (!(await object.isObject())) {
                                console.log(
                                    `${args.id} does not look like an OCFL object`
                                );
                            }

                            // if it loads - index it
                            await processOcflObject({
                                log,
                                configuration,
                                object,
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

async function createIndexAndLoadMapping({
    elasticClient,
    index,
    configuration,
}) {
    let mappings;
    let mappingFile = configuration.mappings
        ? configuration.mappings
        : undefined;
    if (mappingFile && (await pathExists(mappingFile))) {
        mappings = await readJson(mappingFile);
    }
    try {
        await elasticClient.indices.get({index});
    } catch (error) {
        try {
            await elasticClient.indices.create({index});
        } catch (error) {
            // throw new Error(error.meta.body.error.reason);
        }
        if (mappings) {
            try {
                await elasticClient.indices.putMapping({
                    index,
                    body: mappings.mappings,
                });
            } catch (error) {
                console.log(error);
                throw new Error(error.meta.body.error.reason);
            }
        }
    }
}

async function processOcflObject({log, configuration, object}) {
    await object.load();

    //  get the inventory file in the root
    let inventory = await object.getLatestInventory();
    const ocflVersion = inventory.head;

    //  locate the ro crate file and load it
    let roCrateFile = Object.entries(inventory.manifest).map(
        ([hash, paths]) => {
            return paths.filter((p) => {
                p = basename(p);
                return roCrateMetadataFile.includes(p);
            });
        }
    );
    roCrateFile = flattenDeep(roCrateFile)[0];
    // for each version in the object
    let rocrate;

    try {
        const crateFile = await object.resolveFilePath({
            filePath: roCrateFile,
        });
        rocrate = await readJSON(crateFile);
    } catch (error) {
        console.log(error);
        console.error(
            `There was an issue loading the crate file for version '${ocflVersion}'`
        );
        return;
    }

    // load the crate
    const crate = new ROCrate(rocrate);
    crate.index();

    let {domain} = getDomainIdentifier(crate);

    if (!configuration.domains[domain]) {
        configuration.domains[domain] = getDefaultDomainConfiguration();
    }

    const elasticClient = await getElasticClient({
        host: configuration.search.host,
        username: configuration.search.username,
        password: configuration.search.password,
    });
    // set up the index
    await createIndexAndLoadMapping({
        elasticClient,
        index: domain,
        configuration: configuration.domains[domain],
    });

    // index the data in the crate file
    await indexDocument({
        elasticClient,
        log,
        configuration: configuration.domains[domain],
        ocflVersion,
        index: domain,
        crate,
    });

    // index any transcription files in the object
    indexTranscriptions({
        elasticClient,
        log,
        ocflVersion,
        object,
        crate,
    });
}

async function indexDocument({
    elasticClient,
    log,
    configuration,
    ocflVersion,
    index,
    crate,
}) {
    // console.log(JSON.stringify(crate.graph, null, 2));
    let documents;

    const rootDataset = crate.getRootDataset();
    const id = crate
        .resolve(rootDataset, [{property: 'identifier'}])
        .filter((i) => i.name === 'hashId')[0].value;

    if (configuration.indexAs === 'pages') {
        let documentIdentifier = crate
            .resolve(rootDataset, [{property: 'identifier'}])
            .filter((i) => i.name === 'id')[0].value;
        documentIdentifier = `${documentIdentifier}?ocfl_version=${ocflVersion}`;
        documents = buildDocumentIndex({
            documentIdentifier,
            ocflVersion,
            crate,
        });
    } else if (configuration.indexAs === 'entities') {
    }

    documents = documents.filter((d) => {
        return intersection(flattenDeep([d['@type']]), configuration.include)
            .length;
    });
    documents = documents.flatMap((d) => [
        {
            index: {
                _index: index,
                _id: d['@id'].match('#')
                    ? `${d.resource}${d['@id']}`
                    : `${d.resource}#${d['@id']}`,
            },
        },
        d,
    ]);
    try {
        let response = await elasticClient.bulk({
            refresh: true,
            body: documents,
        });
        log.debug(`'${id}' indexed.`);
    } catch (error) {
        log.error(`'${id}' ${error}`);
    }

    return;

    // crate = crate['@graph'];
    // data[`${indexerMetadataNamespace}:type`] = 'document';
    // let id = data.identifier.filter((d) => d.name === 'hashId')[0].value;
    // // console.info(` as ${index}/${id}`);
    // try {
    //     await elasticClient.index({id, index, body: crate});
    // } catch (error) {
    //     throw new Error(error.meta.body.error.reason);
    // }
}

function getDefaultDomainConfiguration() {
    return {
        indexAs: 'entities',
        include: ['Dataset', 'Person', 'Organization', 'Place'],
    };
}

function buildDocumentIndex({documentIdentifier, ocflVersion, crate}) {
    for (let entity of crate.graph) {
        for (let property of Object.keys(entity)) {
            if (ignorePropertyResolution.includes(property)) continue;
            if (entity[property]['@id'] || isArray(entity[property])) {
                let data = crate.resolve([entity], [{property}]);
                entity[property] = data;
            }
        }
    }
    let documents = crate.graph.map((entity) => {
        entity = {
            resource: documentIdentifier,
            ocflVersion,
            ...entity,
        };
        entity[`${indexerMetadataNamespace}:type`] = 'document';
        return entity;
    });
    return documents;
}

async function indexTranscriptions({
    elasticClient,
    log,
    ocflVersion,
    object,
    crate,
}) {
    const transcriptionExtensions = ['eaf', 'trs', 'ixt', 'flextext'];

    let files = crate._item_by_type['File'];
    if (!files) return;
    files = files
        .filter((f) => f.encodingFormat === 'application/xml')
        .filter((f) =>
            transcriptionExtensions.includes(
                basename(f['@id']).split('.').pop()
            )
        );

    const rootDataset = crate.getRootDataset();
    let itemIdentifier = crate
        .resolve(rootDataset, [{property: 'identifier'}])
        .filter((i) => i.name === 'id')[0].value;
    let documentIdentifier = `${itemIdentifier}?ocfl_version=${ocflVersion}`;

    let {id, hashId, domain} = getDomainIdentifier(crate);

    let result, segments;
    for (let file of files) {
        let filePath = await getTranscriptionFilePath({
            object,
            file,
        });
        if (!filePath) {
            log.error(`${file['@id']} not found in the object at ${hashId}`);
            continue;
        }

        log.debug(`Processing transcription ${filePath}`);
        try {
            result = await parseTranscription({filePath});
        } catch (error) {
            console.log(`Error parsing ${filePath}: ${error.message}`);
            continue;
        }

        try {
            const extension = basename(file['@id']).split('.').pop();

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
        } catch (error) {
            console.log(
                `ERROR: processing transcription: ${error.message} ${file.path}`
            );
            if (error.message !== 'No timeslots found in file') {
                console.log(error);
            }
        }

        segments = segments.map((s) => {
            return {
                ...s,
                resource: `${itemIdentifier}`,
                ocflVersion: ocflVersion,
                file: file.name,
            };
        });

        let documents = segments.map((segment) => {
            return {
                id: `${documentIdentifier}-${file['@id']}-${segment.timeBegin}`,
                [`${indexerMetadataNamespace}:type`]: 'segment',
                ...segment,
            };
        });

        documents = documents.flatMap((d) => [
            {
                index: {
                    _index: domain,
                    _id: d.id,
                },
            },
            d,
        ]);
        try {
            let response = await elasticClient.bulk({
                refresh: true,
                body: documents,
            });
            log.debug(`'${id}#${file['@id']}' indexed.`);
        } catch (error) {
            log.error(`'${id}' ${error}`);
        }

        async function parseTranscription({filePath}) {
            let xmlString = await readFile(filePath, 'utf-8');
            let parser = new Parser({
                name: filePath,
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
                    if (!section.turns) return [];
                    return section.turns.map((turn) => {
                        return {
                            text: turn.text,
                            timeBegin: turn.time.begin,
                            timeEnd: turn.time.end,
                        };
                    });
                });
            });
            if (segments) {
                segments = flattenDeep(segments);
            } else {
                segments = [];
            }
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
                        phrase.translation ? phrase.translation.text : '',
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

        async function getTranscriptionFilePath({object, file}) {
            let inventory = await object.getLatestInventory();

            let filePath = Object.entries(inventory.manifest).map(
                ([hash, paths]) => {
                    return paths.filter((p) => p.match(file.name));
                }
            );
            filePath = flattenDeep(filePath)[0];
            return object.resolveFilePath({filePath});
        }
    }
}

const fs = require('fs-extra');
const path = require('path');
const {Client} = require('@elastic/elasticsearch');
const walk = require('walk');
const log = require('ulog')('indexer');
const {pathExists, readJson} = require('fs-extra');
const CRATE_TOOLS = require(`../../../ro-crate-tools`);

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
    let crateTools;
    for (let p of paths) {
        const folder = p.folder;
        log.info(`Walking '${folder}'`);
        await new Promise(async resolve => {
            let walker = walk.walk(folder, {});

            walker.on('file', async (root, fileStats, next) => {
                switch (fileStats.name) {
                    case '0=ocfl_object_1.0':
                        log.debug(`Processing crate at: `, root);
                        const objectPath = root.replace(ocflRoot, '');
                        crateTools = new CRATE_TOOLS({
                            ocflRoot: ocflRoot,
                            objectPath: objectPath,
                        });
                        try {
                            // load the latest crate
                            let {
                                flattenedCrate,
                                objectifiedCrate,
                            } = await crateTools.loadLatestCrate();
                            // console.log(JSON.stringify(objectifiedCrate, null, 2));

                            // validate it
                            const {valid, domain} = await crateTools.validate(
                                {}
                            );
                            if (!valid) {
                                log.error(
                                    `Crate @ ${root} is not valid. Skipping it!`
                                );
                                return;
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

async function indexDocument({elasticClient, data, index}) {
    data = removeContext({data});
    // data = refactorGeoShape({data});
    let id = data.identifier.filter(d => d.name === 'hashId')[0].value;
    // console.info(`Indexing as ${index}/${id}`);
    try {
        await elasticClient.index({id, index, body: data});
    } catch (error) {
        throw new Error(error.meta.body.error.reason);
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

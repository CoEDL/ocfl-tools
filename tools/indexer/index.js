'use strict';

const {chunk} = require('lodash');
const {readdir: readDirectory, statSync} = require('fs-extra');
const path = require('path');
const Pool = require('multiprocessing').Pool;
const log = require('ulog')('indexer');

module.exports = {
    command: 'indexer',
    description: 'Index an OCFL filesystem into Elastic Search',
    builder: {
        domain: {
            describe:
                'The domains on which to operate. Can be specified multiple times.',
            type: 'array',
        },
        walkers: {
            describe: 'The number of filesystem walkers to start',
            type: 'number',
            default: require('os').cpus().length * 2,
        },
        search: {
            demandOption: true,
            describe: 'the URL to the elastic search service',
            type: 'string',
        },
        username: {
            demandOption: true,
            describe: 'The username to log in to elastic with',
            type: 'string',
        },
        password: {
            demandOption: true,
            describe: 'The password to log in to elastic with',
            type: 'string',
        },
        'path-to-object': {
            describe:
                'The path to a single OCFL object to index. Use this to check an object can be indexed. This overrides --source.',
            type: 'string',
        },
    },
    handler: indexer,
    createWalker,
};

async function indexer(args) {
    log.level = log[args.logLevel.toUpperCase()];
    if (args.pathToObject) {
        let paths = [
            {
                folder: path.join(args.source, args.pathToObject),
                args,
            },
        ];
        await createWalker(paths);
    } else {
        let paths = await readDirectory(args.source);
        log.info(`Indexing OCFL content in: ${args.source}`);
        paths = paths.filter(p => {
            const isdir = statSync(path.join(args.source, p)).isDirectory();
            return p != 'deposit' && isdir;
        });
        paths = paths.map(p => {
            return {
                folder: path.join(args.source, p),
                args,
            };
        });
        if (paths.length < args.walkers) {
            paths = chunk(paths, 1);
        } else {
            paths = chunk(paths, paths.length / args.walkers);
        }

        const pool = new Pool(args.numberOfWalkers);
        pool.map(paths, createWalker).then(result => {
            log.info('done');
            process.exit();
        });
    }
}

async function createWalker(paths) {
    const walk = require('walk');
    const log = require('ulog')('indexer');
    const path = require('path');
    const basePath = __dirname.match('node_modules/multiprocessing/build')
        ? path.join(__dirname, '../', '../', '../')
        : path.join(__dirname, '../', '../');
    const CRATE_TOOLS = require(`${basePath}/ro-crate-tools`);
    const {Client} = require('@elastic/elasticsearch');
    const {pathExists, readJson} = require('fs-extra');

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
                        log.info(`Processing crate at: `, root);
                        const objectPath = root.replace(ocflRoot, '');
                        crateTools = new CRATE_TOOLS({
                            ocflRoot: ocflRoot,
                            objectPath: objectPath,
                        });
                        try {
                            let {
                                flattenedCrate,
                                objectifiedCrate,
                            } = await crateTools.loadLatestCrate();
                            // console.log(JSON.stringify(objectifiedCrate, null, 2));
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
                            log.debug(`Setting up index for: `, domain);
                            await createIndexAndLoadMapping({
                                index: domain,
                            });

                            log.debug(`Indexing document at path: `, root);
                            await indexDocument({
                                index: domain,
                                data: objectifiedCrate,
                            });
                        } catch (error) {
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

    async function createIndexAndLoadMapping({index}) {
        let mappings;
        let mappingFile = path.join(
            basePath,
            'tools/indexer/mappings',
            index,
            'mappings.json'
        );
        if (await pathExists(mappingFile)) {
            mappings = await readJson(mappingFile);
        } else {
            mappingFile = path.join(
                basePath,
                'tools/indexer/mappings/mappings.json'
            );
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

    async function indexDocument({data, index}) {
        data = removeContext({data});
        data = refactorGeoShape({data});
        // console.log(JSON.stringify(data, null, 2));
        let id = data.identifier.filter(d => d.name === 'hashId')[0].value;
        // console.info(`Indexing as ${index}/${id}`);
        try {
            await elasticClient.index({id, index, body: data});
        } catch (error) {
            throw new Error(error.meta.body.error.reason);
        }
    }

    function refactorGeoShape({data}) {
        if (!data.contentLocation) return data;
        let shape = data.contentLocation.geo.box;
        let coordinates = [
            shape.split(' ')[0].split(','),
            shape.split(' ')[1].split(','),
        ];
        data.contentLocation = {
            type: 'envelope',
            coordinates,
        };
        return data;
    }

    function removeContext({data}) {
        delete data['@context'];
        return data;
    }
}

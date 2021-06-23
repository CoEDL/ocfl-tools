'use strict';

const yargs = require('yargs');
const {chunk} = require('lodash');
const {readJSON, readdir, statSync} = require('fs-extra');
const path = require('path');
const log = require('ulog')('indexer');
const {Repository} = require('@coedl/ocfl');
const {createWalker, processOcflObject} = require('./lib');

const args = yargs
    .options({
        config: {
            describe: 'The indexing configuration',
            type: 'string',
            demandOption: true,
        },
        repository: {
            describe: 'The path to the OCFL filesystem to index',
            type: 'string',
        },
        scratch: {
            describe: 'The path to the OCFL scratch area',
            type: 'string',
        },
        id: {
            describe:
                'The id of a single OCFL object to index. Use this to run the tool against a specific object.',
            type: 'string',
        },
        'log-level': {
            describe: 'Turn on logging',
            type: 'string',
            default: 'warn',
            choices: ['debug', 'info', 'warn', 'error'],
        },
        walkers: {
            describe: 'The number of filesystem walkers to start',
            type: 'number',
            default: require('os').cpus().length * 2,
        },
        search: {
            describe: 'the URL to the elastic search service',
            type: 'string',
        },
        username: {
            describe: 'The username to log in to elastic with',
            type: 'string',
        },
        password: {
            describe: 'The password to log in to elastic with',
            type: 'string',
        },
    })
    .help().argv;

indexer({args});

async function indexer({args}) {
    // log.level = log[args.logLevel.toUpperCase()];
    let configuration = await readJSON(args.config);
    configuration = mergeConfiguration({configuration, args});
    log.level = log[args.logLevel.toUpperCase()];
    // console.log(JSON.stringify(configuration, null, 2));

    const repository = new Repository({
        ocflRoot: configuration.ocfl.repository,
        ocflScratch: configuration.ocfl.scratch,
    });

    if (!(await repository.isRepository())) {
        console.log(`${args.repository} does not look like an OCFL repository`);
        process.exit();
    }

    if (args.id) {
        // try to load ocfl object
        let object = repository.object({id: args.id});

        if (!(await object.isObject())) {
            console.log(`${args.id} does not look like an OCFL object`);
        }

        // if it loads - index it
        await processOcflObject({log, configuration, object});
    } else {
        // if source walk the ocfl filesystem

        let paths = await (
            await readdir(configuration.ocfl.repository)
        ).filter((p) => p !== '0=ocfl_1.0');

        log.info(`Indexing OCFL content in: ${configuration.ocfl.repository}`);
        paths = paths.filter((p) => {
            return statSync(
                path.join(configuration.ocfl.repository, p)
            ).isDirectory();
        });
        paths = paths.map((p) => {
            return {
                folder: path.join(configuration.ocfl.repository, p),
                log,
                configuration,
            };
        });
        if (paths.length < args.walkers) {
            paths = chunk(paths, 1);
        } else {
            paths = chunk(paths, paths.length / args.walkers);
        }

        // create the filesystem walkers
        let runners = paths.map((p, idx) => createWalker({paths: p, idx}));
        try {
            // run them
            await Promise.all(runners);
        } catch (error) {
            console.log(error);
            process.exit();
        }
    }
}

function mergeConfiguration({configuration, args}) {
    if (args.search) configuration.search.host = args.search;
    if (args.username) configuration.search.username = args.username;
    if (args.password) configuration.search.password = args.password;
    if (args.repository) configuration.ocfl.repository = args.repository;
    if (args.scratch) configuration.ocfl.scratch = args.scratch;
    return configuration;
}

// await createIndicesAndLoadMappings({args});

// if (args.pathToObject) {
//     let paths = [
//         {
//             folder: path.join(args.source, args.pathToObject),
//             args,
//         },
//     ];
//     await createWalker({paths, idx: 1});
// } else {
//     let paths = await readDirectory(args.source);
//     log.info(`Indexing OCFL content in: ${args.source}`);
//     paths = paths.filter((p) => {
//         const isdir = statSync(path.join(args.source, p)).isDirectory();
//         return p != 'deposit' && isdir;
//     });
//     paths = paths
//         .map((p) => {
//             return {
//                 folder: path.join(args.source, p),
//                 args,
//             };
//         })
//         .filter((p) => !p.folder.match('deposit'))
//         .filter((p) => !p.folder.match('backup'));
//     if (paths.length < args.walkers) {
//         paths = chunk(paths, 1);
//     } else {
//         paths = chunk(paths, paths.length / args.walkers);
//     }

//     let runners = paths.map((p, idx) => createWalker({paths: p, idx}));
//     try {
//         await Promise.all(runners);
//     } catch (error) {
//         console.log(error);
//         process.exit();
//     }
// }

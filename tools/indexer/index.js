'use strict';

const {chunk} = require('lodash');
const {readdir: readDirectory, statSync} = require('fs-extra');
const path = require('path');
const log = require('ulog')('indexer');
const {createWalker, createIndicesAndLoadMappings} = require('./src/lib');

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
    log.debug('Creating indices and loadding mappings');
    await createIndicesAndLoadMappings({args});

    if (args.pathToObject) {
        let paths = [
            {
                folder: path.join(args.source, args.pathToObject),
                args,
            },
        ];
        await createWalker({paths, idx: 1});
    } else {
        let paths = await readDirectory(args.source);
        log.info(`Indexing OCFL content in: ${args.source}`);
        paths = paths.filter((p) => {
            const isdir = statSync(path.join(args.source, p)).isDirectory();
            return p != 'deposit' && isdir;
        });
        paths = paths
            .map((p) => {
                return {
                    folder: path.join(args.source, p),
                    args,
                };
            })
            .filter((p) => !p.folder.match('deposit'))
            .filter((p) => !p.folder.match('backup'));
        if (paths.length < args.walkers) {
            paths = chunk(paths, 1);
        } else {
            paths = chunk(paths, paths.length / args.walkers);
        }

        let runners = paths.map((p, idx) => createWalker({paths: p, idx}));
        try {
            await Promise.all(runners);
        } catch (error) {
            console.log(error);
            process.exit();
        }
    }
}

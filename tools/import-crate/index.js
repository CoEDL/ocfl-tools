'use strict';

const yargs = require('yargs');
const {
    pathExists,
    mkdirs,
    remove,
    readdir,
    copy,
    readJSON,
    writeJSON,
} = require('fs-extra');
const path = require('path');
const {Repository, OcflObject} = require('@coedl/ocfl');
const extract = require('extract-zip');
const crypto = require('crypto');
const {has, isArray, isString, isPlainObject, cloneDeep} = require('lodash');

module.exports = {
    command: 'import-crate',
    description: 'Import an RO-Crate into your OCFL filesystem',
    builder: {
        'repository-identifier': {
            demandOption: true,
            describe:
                'An identifier for this repository - a FQDN is a good idea',
            type: 'string',
        },
        metadata: {
            describe:
                'Path to a file containing repository specific metadata to be injected into this object at ingestion',
            type: 'string',
        },
        crate: {
            demandOption: true,
            describe: 'The path to the zipped crate to be imported',
            type: 'string',
        },
        domain: {
            demandOption: true,
            describe: 'the domain identifier',
            type: 'string',
        },
        identifier: {
            demandOption: true,
            describe: 'the identifier for this item',
            type: 'string',
        },
    },
    handler: importer,
    checkArchiveToImport,
    connectToOcflRepository,
    defineRepositoryMetadataProperty,
    addRepositoryMetadataReference,
    writeRepositoryMetadata,
    depositIntoOcfl,
};

async function importer(args) {
    try {
        // TODO: if external metadata referenced - load it here
        const metadata = {
            repositoryIdentifier: args.repositoryIdentifier,
            domain: args.domain,
            identifier: `/${args.domain}/${encodeURIComponent(
                args.identifier
            )}`,
        };
        // have we been provided with a zip file - error out if not
        await checkArchiveToImport({archive: args.crate});
        const repository = await connectToOcflRepository({
            path: args.source,
        });

        await depositIntoOcfl({repository, metadata, archive: args.crate});
        process.exit();
    } catch (error) {
        console.log(error.message);
        process.exit(-1);
    }
}

async function checkArchiveToImport({archive}) {
    if (!(await pathExists(archive))) {
        throw new Error(`'${archive}' not found.`);
    }

    // dumb check to see if the file has a .zip extension
    if (!archive.match(/\.zip/)) {
        throw new Error(
            `Is '${archive}' a zip file? Currently, only zip files are supported.`
        );
    }
}

async function connectToOcflRepository({path}) {
    if (!(await pathExists(path))) {
        throw new Error(`'${path} does not exist`);
    }
    const repository = new Repository({ocflRoot: path});
    let isRepository = await repository.isRepository();
    if (!isRepository) {
        throw new Error(`${path} does not seem to be an OCFL repository`);
    }
    return repository;
}

async function depositIntoOcfl({repository, metadata, archive}) {
    metadata.hashId = crypto
        .createHash('sha512')
        .update(metadata.identifier)
        .digest('hex');

    let object = new OcflObject({
        ocflRoot: repository.ocflRoot,
        id: metadata.hashId,
    });
    try {
        const {inventory} = await object.update({writer, commit: false});
        await object.load();
        let versions = await object.getVersions();
        if (versions.length > 1) {
            versions = {
                next: versions.pop().version,
                previous: versions.pop().version,
            };
            let diff = await object.diffVersions(versions);
            let decide = diff.next.filter(
                (filename) => !filename.match(/repository-metadata/)
            );

            // If decide is an empty array then the only change was to the
            //  repo metadata so we won't continue with the cleanup but just
            //  remove the object from depost.
            if (!decide.length) {
                await object.remove();
                return;
            }
        }
        await object.commit({inventory});
    } catch (error) {
        console.log(error.message);
        await object.remove();
    }

    async function writer({target}) {
        await extract(path.resolve(archive), {dir: target});
        let content = await readdir(target);
        if (content.length === 1 && content[0] !== 'ro-crate-metadata.json') {
            const subfolder = content[0];
            content = await readdir(path.join(target, content[0]));
            if (!content.includes('ro-crate-metadata.json')) {
                throw new Error(
                    `The '${archive} doesn't look like an RO-Crate; no ro-crate-metadata.json in the root.`
                );
            }
            await copy(path.join(target, subfolder), target);
            content = await readdir(target);
            await remove(path.join(target, subfolder));
        } else {
            if (!content.includes('ro-crate-metadata.json')) {
                throw new Error(
                    `The '${archive} doesn't look like an RO-Crate; no ro-crate-metadata.json in the root.`
                );
            }
        }

        const repositoryMetadataIdentifier = `_:ocflRepositoryMetadata`;
        const rocrateFile = path.join(target, 'ro-crate-metadata.json');
        const crate = await readJSON(rocrateFile);
        let context = cloneDeep(crate['@context']);
        let graph = cloneDeep(crate['@graph']);

        ({context, graph} = defineRepositoryMetadataProperty({
            context,
            graph,
            repositoryMetadataIdentifier,
        }));
        let repositoryMetadataFile;
        ({graph, repositoryMetadataFile} = await addRepositoryMetadataReference(
            {
                graph,
                metadata,
                target,
            }
        ));

        await writeJSON(rocrateFile, {'@context': context, '@graph': graph});
        await writeRepositoryMetadata({
            target,
            metadata,
            repositoryMetadataFile,
        });
    }
}

function defineRepositoryMetadataProperty({
    context,
    graph,
    repositoryMetadataIdentifier,
}) {
    // define the repository metadata property
    if (!isArray(context)) context = [context];
    context = context.map((e) => {
        if (isString(e)) {
            return e;
        } else if (isPlainObject(e) && !has(e, 'ocflRepositoryMetadata')) {
            e.ocflRepositoryMetadata = repositoryMetadataIdentifier;
            return e;
        } else {
            return e;
        }
    });

    // inject the property definition into the graph
    graph = graph.filter((e) => e['@id'] !== repositoryMetadataIdentifier);
    graph.push({
        '@id': repositoryMetadataIdentifier,
        '@type': 'Property',
        name: 'ocflRepositoryMetadata',
        description: `A reference to @type = File objects that define the repository metadata configurations. These files must be named as /repository-metadata/\${FQDN of the repository}.metadata.json`,
    });
    return {context, graph};
}

async function addRepositoryMetadataReference({graph, metadata, target}) {
    // add the repository metadata to the crate
    const repositoryMetadataFile = path.join(
        '/repository-metadata',
        `${metadata.repositoryIdentifier}.metadata.json`
    );
    if (!(await pathExists(path.join(target, 'repository-metadata')))) {
        await mkdirs(path.join(target, 'repository-metadata'));
    }

    // get the root dataset and add the property if required
    const rootDataset = graph.filter((entry) => entry['@id'] === './')[0];
    if (!has(rootDataset, 'ocflRepositoryMetadata')) {
        rootDataset.ocflRepositoryMetadata = [];
    }

    // see if we have a reference to the metadata entry for this repo
    const repositoryReference = rootDataset.ocflRepositoryMetadata.filter(
        (entry) => entry['@id'] === repositoryMetadataFile
    );

    // add it if not
    if (!repositoryReference.length) {
        rootDataset.ocflRepositoryMetadata.push({
            '@id': repositoryMetadataFile,
        });
    }

    // create the entry for this file in the graph
    graph = graph.filter((entry) => entry['@id'] !== repositoryMetadataFile);
    graph.push({
        '@type': 'File',
        '@id': repositoryMetadataFile,
    });

    graph = graph.filter((entry) => entry['@id'] != './');
    graph = [rootDataset, ...graph];

    return {
        graph,
        repositoryMetadataFile,
    };
}

async function writeRepositoryMetadata({
    repositoryMetadataFile,
    metadata,
    target,
}) {
    let metadataFile = path.resolve(path.join(target, repositoryMetadataFile));
    let data;
    if (await pathExists(metadataFile)) {
        data = await readJSON(metadataFile);
        let graph = data['@graph'];
        let repoObject = graph.filter(
            (e) => e['@type'] === 'RepositoryObject'
        )[0];
        repoObject.dateModified = new Date().toISOString();
        graph = graph.filter((e) => e['@type'] !== 'RepositoryObject');
        graph = [repoObject, ...graph];
    } else {
        data = {
            '@context': [
                'https://researchobject.github.io/ro-crate/1.0/context.jsonld',
                {
                    '@vocab': 'http://schema.org/',
                },
            ],
            '@graph': [
                {
                    '@type': 'RepositoryObject',
                    '@id': repositoryMetadataFile,
                    dateCreated: new Date().toISOString(),
                    identifier: [
                        {
                            '@type': 'PropertyValue',
                            name: 'domain',
                            value: metadata.domain,
                        },
                        {
                            '@type': 'PropertyValue',
                            name: 'id',
                            value: metadata.identifier,
                        },
                        {
                            '@type': 'PropertyValue',
                            name: 'hashId',
                            value: metadata.hashId,
                        },
                    ],
                },
            ],
        };
    }
    await writeJSON(metadataFile, data, {spaces: 2});
}

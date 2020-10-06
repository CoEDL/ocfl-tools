import path from 'path';
import {remove, ensureFile, mkdirs, readJSON} from 'fs-extra';
import {Repository, OcflObject} from '@coedl/ocfl';
import crypto from 'crypto';
import {
    connectToOcflRepository,
    defineRepositoryMetadataProperty,
    addRepositoryMetadataReference,
    checkArchiveToImport,
    writeRepositoryMetadata,
    depositIntoOcfl,
} from './index';

const ocflRepo = path.join(__dirname, '..', '..', 'test-data', 'tmp');
beforeEach(async () => {
    await mkdirs(ocflRepo);
    const repository = new Repository({ocflRoot: ocflRepo});
    await repository.create();
});
afterEach(async () => {
    await remove(ocflRepo);
});

test('it should look like an archive we can import', async () => {
    let archive = path.join(__dirname, 'archive.zip');
    await ensureFile(archive);
    expect(async () => {
        await checkArchiveToImport({archive});
    }).not.toThrow();
    await remove(archive);

    archive = path.join(__dirname, 'archive.txt');
    await expect(checkArchiveToImport({archive})).rejects.toThrow(Error);

    archive = path.join(__dirname, 'archive.txt');
    await ensureFile(archive);
    await expect(checkArchiveToImport({archive})).rejects.toThrow(Error);
    await remove(archive);
});
test('it should inject the repositoryMetadata property into the crate data', () => {
    const repositoryMetadataIdentifier = `_:ocflRepositoryMetadata`;
    let context = [
        'https://researchobject.github.io/ro-crate/1.0/context.jsonld',
        {
            '@vocab': 'http://schema.org/',
        },
    ];
    let graph = [
        {
            '@type': 'Dataset',
            '@id': './',
        },
    ];

    // confirm we get back graph / context items with the extra information
    let response = defineRepositoryMetadataProperty({
        context,
        graph,
        repositoryMetadataIdentifier,
    });
    expect(response.context).toEqual([
        'https://researchobject.github.io/ro-crate/1.0/context.jsonld',
        {
            '@vocab': 'http://schema.org/',
            ocflRepositoryMetadata: '_:ocflRepositoryMetadata',
        },
    ]);
    expect(response.graph.length).toBe(2);
    expect(response.graph[1]).toEqual({
        '@id': '_:ocflRepositoryMetadata',
        '@type': 'Property',
        name: 'ocflRepositoryMetadata',
        description:
            'A reference to @type = File objects that define the repository metadata configurations. These files must be named as /repository-metadata/${FQDN of the repository}.metadata.json',
    });
});
test('it should inject the repositoryMetadata property into the crate data', () => {
    const repositoryMetadataIdentifier = `_:ocflRepositoryMetadata`;
    let context = [
        'https://researchobject.github.io/ro-crate/1.0/context.jsonld',
        {
            '@vocab': 'http://schema.org/',
        },
    ];
    let graph = [
        {
            '@type': 'Dataset',
            '@id': './',
        },
    ];

    // confirm we get back graph / context items with the extra information
    let response = defineRepositoryMetadataProperty({
        context,
        graph,
        repositoryMetadataIdentifier,
    });
    expect(response.context).toEqual([
        'https://researchobject.github.io/ro-crate/1.0/context.jsonld',
        {
            '@vocab': 'http://schema.org/',
            ocflRepositoryMetadata: '_:ocflRepositoryMetadata',
        },
    ]);
    expect(response.graph.length).toBe(2);
    expect(response.graph[1]).toEqual({
        '@id': '_:ocflRepositoryMetadata',
        '@type': 'Property',
        name: 'ocflRepositoryMetadata',
        description:
            'A reference to @type = File objects that define the repository metadata configurations. These files must be named as /repository-metadata/${FQDN of the repository}.metadata.json',
    });

    // run the updated graph / context again and confirm we don't get
    //   duplicated data
    response = defineRepositoryMetadataProperty({
        context: response.context,
        graph: response.graph,
        repositoryMetadataIdentifier,
    });

    expect(response.context).toEqual([
        'https://researchobject.github.io/ro-crate/1.0/context.jsonld',
        {
            '@vocab': 'http://schema.org/',
            ocflRepositoryMetadata: '_:ocflRepositoryMetadata',
        },
    ]);
    expect(response.graph.length).toBe(2);
});
test(`it should add a repository metadata property`, async () => {
    const metadata = {
        repositoryIdentifier: 'my.repo.fqdn',
    };
    let graph = [
        {'@type': 'Dataset', '@id': './'},
        {
            '@id': '_:ocflRepositoryMetadata',
            '@type': 'Property',
            name: 'ocflRepositoryMetadata',
            description:
                'A reference to @type = File objects that define the repository metadata configurations. These files must be named as /repository-metadata/${FQDN of the repository}.metadata.json',
        },
    ];
    let response = await addRepositoryMetadataReference({
        graph,
        metadata,
        target: ocflRepo,
    });

    // confirm we add the property and one reference
    expect(response.graph.length).toBe(3);
    expect(response.graph[0]).toHaveProperty('ocflRepositoryMetadata');
    expect(response.graph[0].ocflRepositoryMetadata).toEqual([
        {
            '@id': response.repositoryMetadataFile,
        },
    ]);

    // ensure we don't duplicate an existing reference
    response = await addRepositoryMetadataReference({
        graph: response.graph,
        metadata,
        target: ocflRepo,
    });
    expect(response.graph[0].ocflRepositoryMetadata.length).toBe(1);

    const fileEntries = response.graph.filter((e) => e['@type'] === 'File');
    expect(fileEntries.length).toEqual(1);
    expect(fileEntries[0]['@id']).toEqual(
        `/repository-metadata/${metadata.repositoryIdentifier}.metadata.json`
    );
});
test(`it should write out the repository metadata file`, async () => {
    const metadata = {
        domain: 'paradisec.org.au',
        identifier: '/paradisec.org.au/my-dataset1',
        repositoryIdentifier: 'my.repo.fqdn',
        hashId: 'xxxxx',
    };
    let graph = [
        {'@type': 'Dataset', '@id': './'},
        {
            '@id': '_:ocflRepositoryMetadata',
            '@type': 'Property',
            name: 'ocflRepositoryMetadata',
            description:
                'A reference to @type = File objects that define the repository metadata configurations. These files must be named as /repository-metadata/${FQDN of the repository}.metadata.json',
        },
    ];
    let response = await addRepositoryMetadataReference({
        graph,
        metadata,
        target: ocflRepo,
    });

    // write out repo metadata file
    await writeRepositoryMetadata({
        target: ocflRepo,
        metadata,
        repositoryMetadataFile: response.repositoryMetadataFile,
    });

    let metadataFile = path.resolve(
        path.join(ocflRepo, response.repositoryMetadataFile)
    );

    let data = await readJSON(metadataFile);
    let repoObj = data['@graph'][0];
    expect(repoObj['@id']).toBe(response.repositoryMetadataFile);
    expect(repoObj.identifier).toEqual([
        {
            '@type': 'PropertyValue',
            name: 'domain',
            value: 'paradisec.org.au',
        },
        {
            '@type': 'PropertyValue',
            name: 'id',
            value: '/paradisec.org.au/my-dataset1',
        },
        {
            '@type': 'PropertyValue',
            name: 'hashId',
            value: 'xxxxx',
        },
    ]);
});
test(`it should be able to deposit a zip archive into OCFL - crate file in zip root`, async () => {
    let args = {
        repositoryIdentifier: 'ocfl-demonstrator.paradisec.org.au',
        domain: 'paradisec.org.au',
        identifier: 'test-1',
        source: ocflRepo,
        crate: path.join(__dirname, '..', '..', 'test-data', 'test.zip'),
    };
    // console.log(args);
    const metadata = {
        repositoryIdentifier: args.repositoryIdentifier,
        domain: args.domain,
        identifier: `/${args.domain}/${encodeURIComponent(args.identifier)}`,
    };
    // have we been provided with a zip file - error out if not
    await checkArchiveToImport({archive: args.crate});
    const repository = await connectToOcflRepository({
        path: args.source,
    });

    await depositIntoOcfl({repository, metadata, archive: args.crate});
    await depositIntoOcfl({repository, metadata, archive: args.crate});

    const hashId = crypto
        .createHash('sha512')
        .update(metadata.identifier)
        .digest('hex');
    const object = new OcflObject({ocflRoot: repository.ocflRoot, id: hashId});
    await object.load();
    const versions = await object.getVersions();
    expect(versions.length).toBe(1);
    expect(versions[0].version).toBe('v1');
});
test(`it should be able to deposit a zip archive into OCFL - crate file in subfolder`, async () => {
    let args = {
        repositoryIdentifier: 'ocfl-demonstrator.paradisec.org.au',
        domain: 'paradisec.org.au',
        identifier: 'test-1',
        source: ocflRepo,
        crate: path.join(
            __dirname,
            '..',
            '..',
            'test-data',
            'test-subfolder.zip'
        ),
    };
    // console.log(args);
    const metadata = {
        repositoryIdentifier: args.repositoryIdentifier,
        domain: args.domain,
        identifier: `/${args.domain}/${encodeURIComponent(args.identifier)}`,
    };
    // have we been provided with a zip file - error out if not
    await checkArchiveToImport({archive: args.crate});
    const repository = await connectToOcflRepository({
        path: args.source,
    });

    await depositIntoOcfl({repository, metadata, archive: args.crate});

    const hashId = crypto
        .createHash('sha512')
        .update(metadata.identifier)
        .digest('hex');
    const object = new OcflObject({ocflRoot: repository.ocflRoot, id: hashId});
    await object.load();
    const versions = await object.getVersions();
    const latestVersion = await object.getLatestVersion();
    const keys = Object.keys(latestVersion.state);
    expect(keys).toEqual([
        'ocfl-demonstrator.paradisec.org.au.metadata.json',
        'ro-crate-metadata.json',
    ]);
});

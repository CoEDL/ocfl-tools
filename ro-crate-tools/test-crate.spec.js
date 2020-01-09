'use strict';

const path = require('path');
const {readJson} = require('fs-extra');
const CRATE_TOOLS = require('./index');

test('test crate can be instantiated', async () => {
    const crateTools = new CRATE_TOOLS({
        ocflRoot: path.join(__dirname, '../test-data/'),
        objectPath: 'ocfl-object-1',
    });
    expect(crateTools.objectPath).toBe('ocfl-object-1');
    expect(crateTools.ocflObject.ocflRoot).toBe(
        '/Users/mlarosa/src/pdsc/ocfl-tools/test-data/'
    );
});

test('test getting latest version of crate', async () => {
    const crateTools = new CRATE_TOOLS({
        ocflRoot: path.join(__dirname, '../test-data/'),
        objectPath: 'ocfl-object-1',
    });
    const crateMetadata = await crateTools.getLatestVersion();
    expect(crateMetadata.version).toBe('v1');
    expect(Object.keys(crateMetadata.state)).toEqual([
        'AC1-001-A.mp3',
        'ro-crate-metadata.jsonld',
    ]);
});

test('test loading latest crate', async () => {
    const crateTools = new CRATE_TOOLS({
        ocflRoot: path.join(__dirname, '../test-data/'),
        objectPath: 'ocfl-object-1',
    });
    const crate = await crateTools.loadLatestCrate();
    expect(crate.flattenedCrate).toBeTruthy();
    expect(crate.objectifiedCrate).toBeTruthy();
});

test('getting a compacted crate', async () => {
    const crateTools = new CRATE_TOOLS({
        ocflRoot: path.join(__dirname, '../test-data/'),
        objectPath: 'ocfl-object-1',
    });
    const crate = await crateTools.loadLatestCrate();
    const {valid, domain} = await crateTools.validate({});
    const compactedCrate = await crateTools.compact();
    const identifierValues = compactedCrate.identifier.map(i => i.value).sort();
    expect(identifierValues).toEqual([
        '/paradisec.org.au/AC1/001',
        '001',
        '10.4225/72/56E97C3321C5D',
        'AC1',
        'bf9919556e5ac297f01dc6beacc843f9748dcceceb5aa4eba004d6bb349cced2',
        'paradisec.org.au',
    ]);
});

test('test crate verifies - paradisec item with domain defined', async () => {
    const crateTools = new CRATE_TOOLS({
        ocflRoot: path.join(__dirname, '../test-data/'),
        objectPath: 'ocfl-object-1',
    });
    const crate = await crateTools.loadLatestCrate();
    const {valid, domain} = await crateTools.validate({});
    expect(valid).toBeTruthy();
    expect(domain).toBe('paradisec.org.au');
});

test('test crate verifies - paradisec item without domain defined', async () => {
    const crateTools = new CRATE_TOOLS({
        ocflRoot: path.join(__dirname, '../test-data/'),
        objectPath: 'ocfl-object-2',
    });
    const crate = await crateTools.loadLatestCrate();
    const {valid, domain} = await crateTools.validate({});
    expect(valid).toBeTruthy();
    expect(domain).toBe('default');
});

test('test crate verifies - paradisec collection without domain defined', async () => {
    const crateTools = new CRATE_TOOLS({
        ocflRoot: path.join(__dirname, '../test-data/'),
        objectPath: 'ocfl-object-3',
    });
    const crate = await crateTools.loadLatestCrate();
    const {valid, domain} = await crateTools.validate({});
    expect(valid).toBeTruthy();
    expect(domain).toBe('default');
});

test('test crate verifies - object with neither domain nor additionalType defined', async () => {
    const crateTools = new CRATE_TOOLS({
        ocflRoot: path.join(__dirname, '../test-data/'),
        objectPath: 'ocfl-object-4',
    });
    const crate = await crateTools.loadLatestCrate();
    const {valid, domain} = await crateTools.validate({});
    expect(valid).toBeTruthy();
    expect(domain).toBe('default');
});

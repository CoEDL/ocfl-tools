'use strict';

const {createWalker} = require('./index');
const rp = require('request-promise-native');

const elasticService = 'http://localhost:9200';
const elasticUsername = 'indexer';
const elasticPassword = 'somerandompassword';

beforeEach(async () => {
    const options = {
        method: 'DELETE',
        uri: `${elasticService}/_all`,
        headers: {
            Authorization: `Basic ${new Buffer.from(
                elasticUsername + ':' + elasticPassword
            ).toString('base64')}`,
        },
    };
    await rp(options);
});

it('paradisec.org.au example: should create a domain index, load the mapping for it and index a document', async () => {
    const paths = [
        {
            folder: './test-data/ocfl-object-1',
            args: {
                _: [Array],
                search: elasticService,
                username: elasticUsername,
                password: elasticPassword,
                source: './test-data',
                'log-level': 'info',
                logLevel: 'info',
                walkers: 32,
                $0: 'ocfl-tools.js',
            },
        },
    ];
    await createWalker(paths);

    const options = {
        method: 'GET',
        uri: `${elasticService}/_cat/indices`,
        headers: {
            Authorization: `Basic ${new Buffer.from(
                elasticUsername + ':' + elasticPassword
            ).toString('base64')}`,
        },
    };
    let result = await rp(options);
    expect(result.split(' ')[2]).toBe('paradisec.org.au');

    options.uri = `${elasticService}/_mappings`;
    result = JSON.parse(await rp(options));
    expect(Object.keys(result)).toEqual(['paradisec.org.au']);

    await new Promise(resolve => setTimeout(resolve, 1500));

    options.uri = `${elasticService}/_search`;
    result = JSON.parse(await rp(options));
    expect(result.hits.total.value).toEqual(1);
});

it('uts.edu.au example: should fail to create a domain index, load the mapping for it and index a document', async () => {
    // the domain is set to /uts.edu.au which can't be a index name (illegal char: /)
    const paths = [
        {
            folder: './test-data/ocfl-object-5',
            args: {
                _: [Array],
                search: elasticService,
                username: elasticUsername,
                password: elasticPassword,
                source: './test-data',
                'log-level': 'info',
                logLevel: 'info',
                walkers: 32,
                $0: 'ocfl-tools.js',
            },
        },
    ];
    await createWalker(paths);

    const options = {
        method: 'GET',
        uri: `${elasticService}/_cat/indices`,
        headers: {
            Authorization: `Basic ${new Buffer.from(
                elasticUsername + ':' + elasticPassword
            ).toString('base64')}`,
        },
    };
    let result = await rp(options);
    expect(result).toBe('');
});

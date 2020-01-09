'use strict';

const {isArray, isPlainObject} = require('lodash');
const jsonld = require('jsonld');
const Ajv = require('ajv');
const util = require('util');
const readFile = util.promisify(require('fs').readFile);
const ajv = new Ajv({verbose: true});
const {stat, pathExists, readFileSync, readJson} = require('fs-extra');
const path = require('path');
const context = JSON.parse(
    readFileSync(path.join(__dirname, './jsonldcontext.jsonld'))
);
const {ROCrate} = require('ro-crate');
const {OcflObject} = require('ocfl');
const schemaPath = './json-validation-schema';
const log = require('ulog')('crate-tools');

const maintainIds = [
    'http://pcdm.org/models#hasMember',
    'http://schema.org/memberOf',
    'http://schema.org/hasPart',
];

class CRATE_TOOLS {
    constructor({ocflRoot, objectPath}) {
        this.objectPath = objectPath;
        this.ocflObject = new OcflObject({ocflRoot, objectPath});
    }

    async getLatestVersion() {
        await this.ocflObject.load();
        return await this.ocflObject.getLatestVersion();
    }

    async loadLatestCrate() {
        await this.ocflObject.load();
        return await this.loadCrate({
            ocflVersion: 'latest',
            crateVersion: 'latest',
        });
    }

    async loadCrate({ocflVersion, crateVersion}) {
        let state, crate;
        if (ocflVersion === 'latest') {
            state = (await this.ocflObject.getLatestVersion()).state;
        } else {
            state = (await this.ocflObject.getVersion({version: ocflVersion}))
                .state;
        }
        if (crateVersion === 'latest') {
            crate = state['ro-crate-metadata.jsonld'].pop();
        } else {
            crate = state['ro-crate-metadata.jsonld'].filter(
                v => v.version === crateVersion
            );
        }
        let crateFilePath = this.ocflObject.resolveFilePath({
            filePath: crate.path,
        });
        this.flattenedCrate = await readJson(crateFilePath);
        const rocrate = new ROCrate(this.flattenedCrate);
        await rocrate.objectify();
        this.objectifiedCrate = rocrate.objectified;
        return {
            flattenedCrate: this.flattenedCrate,
            objectifiedCrate: this.objectifiedCrate,
        };
    }

    async getCrate() {
        return {
            flattenedCrate: this.flattenedCrate,
            objectifiedCrate: this.objectifiedCrate,
        };
    }

    async validate({verbose}) {
        let verified = true;
        const data = {...this.objectifiedCrate};
        let domain = data.identifier.filter(
            i => i.name && i.name[0] === 'domain'
        );
        if (!domain.length) {
            domain = 'default';
        } else {
            domain = domain[0].value[0];
        }
        const additionalType = data.additionalType
            ? data.additionalType[0]
            : null;

        // perform generic verification
        // console.log(JSON.stringify(data, null, 2));
        if (verbose)
            log.info(
                `Validating '${this.ocflObject.repositoryPath}' against ${schemaPath}/schema.json`
            );
        let schema = path.join(__dirname, `${schemaPath}/schema.json`);
        schema = await readJson(schema);
        let valid = await ajv.validate(schema, data);
        if (!valid) console.log(ajv.errors);
        if (valid && verbose)
            log.info(`Crate structure validates successfully.\n`);
        // console.log(JSON.stringify(data, null, 2));
        // are there domain specific validators
        if (domain !== 'default') {
            let stats;
            try {
                stats = await stat(path.join(__dirname, schemaPath, domain));
            } catch (error) {
                // no domain specific validators
            }
            if (stats && stats.isDirectory()) {
                // perform domain specific, type generic validation
                schema = path.join(
                    __dirname,
                    schemaPath,
                    domain,
                    'schema.json'
                );
                let exists = await pathExists(schema);
                if (exists) {
                    if (verbose)
                        log.info(
                            `Validating '${this.ocflObject.repositoryPath}' against ${schema}`
                        );
                    schema = await readJson(schema);
                    let valid = await ajv.validate(schema, data);
                    if (!valid) console.log(ajv.errors);
                    if (valid && verbose)
                        log.info(`Crate structure validates successfully.\n`);
                }

                // perform domain specific, type specific validation
                schema = path.join(
                    __dirname,
                    schemaPath,
                    domain,
                    `${additionalType}.schema.json`
                );
                exists = await pathExists(schema);
                if (exists) {
                    if (verbose)
                        log.info(
                            `Validating '${this.ocflObject.repositoryPath}' against ${schema}`
                        );
                    schema = await readJson(schema);
                    let valid = await ajv.validate(schema, data);
                    if (!valid) console.log(ajv.errors);
                    if (valid && verbose)
                        log.info(`Crate structure validates successfully.\n`);
                }
            }
        }

        return {valid, domain};
    }

    async compact() {
        return await jsonld.compact(this.objectifiedCrate, context, {
            base: null,
            // compactArrays: false,
            compactToRelative: true,
            skipExpansion: true,
        });
    }
}

module.exports = CRATE_TOOLS;

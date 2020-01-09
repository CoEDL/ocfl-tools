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
        if (valid && verbose) log.info(`Crate validates successfully.\n`);
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
                        log.info(`Crate validates successfully.\n`);
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
                        log.info(`Crate validates successfully.\n`);
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

    // async objectify() {
    //     let data = await jsonld.expand(this.data);
    //     // console.log(JSON.stringify(data, null, 2));

    //     let root = data.filter(i => {
    //         if (i['@type'])
    //             return i['@type'].includes('http://schema.org/Dataset');
    //     })[0];
    //     let content = data.filter(i => {
    //         if (i['@type'])
    //             return !i['@type'].includes('http://schema.org/Dataset');
    //         return i;
    //     });
    //     // console.log(JSON.stringify(content, null, 2));

    //     let rootProperties = Object.keys(root);
    //     for (let property of rootProperties) {
    //         let item = root[property];
    //         if (isArray(item)) {
    //             item = mapContent({property, item, content});
    //             root[property] = [...item];
    //         }
    //     }
    //     // console.log(JSON.stringify(root, null, 2));

    //     this.objectified = await compact(root);
    //     // console.log(JSON.stringify(this.objectified, null, 2));

    //     async function compact(root) {
    //         return await jsonld.compact(root, context, {
    //             base: null,
    //             // compactArrays: false,
    //             compactToRelative: true,
    //             skipExpansion: true,
    //         });
    //     }

    //     function mapContent({property, item, content}) {
    //         item = item.map(entry => {
    //             if (entry['@id']) {
    //                 let entryData = content.filter(
    //                     c => c['@id'] === entry['@id']
    //                 )[0];

    //                 if (entryData) {
    //                     let properties = Object.keys(entryData);
    //                     for (let prop of properties) {
    //                         if (isArray(entryData[prop]))
    //                             entryData[prop] = mapContent({
    //                                 property: prop,
    //                                 item: entryData[prop],
    //                                 content,
    //                             });
    //                     }
    //                     entry = {...entry, ...entryData};
    //                     if (!maintainIds.includes(property))
    //                         delete entry['@id'];
    //                 }
    //             }
    //             return entry;
    //         });
    //         return item;
    //     }
    // }

    remap() {
        this.objectified.contributor = flattenContributor({
            contributor: this.objectified.contributor,
        });

        function flattenContributor({contributor}) {
            if (isPlainObject(contributor)) {
                contributor = [contributor];
            }
            contributor = contributor.map(c => {
                return {
                    name: c.contributor.name,
                    role: c.name,
                };
            });
            return contributor;
        }
    }
}

module.exports = CRATE_TOOLS;

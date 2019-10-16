"use strict";

const { isArray, isPlainObject } = require("lodash");
const jsonld = require("jsonld");
const Ajv = require("ajv");
const util = require("util");
const readFile = util.promisify(require("fs").readFile);
const ajv = new Ajv();
const fs = require("fs");
const context = JSON.parse(fs.readFileSync("./jsonldcontext.jsonld"));

const maintainIds = [
    "http://pcdm.org/models#hasMember",
    "http://schema.org/memberOf",
    "http://schema.org/hasPart"
];

class JSON_LOADER {
    constructor() {
        (async () => {
            this.itemSchema = JSON.parse(await readFile("./item.schema.json"));
            this.collectionSchema = JSON.parse(
                await readFile("./collection.schema.json")
            );
        })();
    }

    init({ path, filename, data }) {
        this.path = path;
        this.name = filename;
        this.data = data;
        this.objectified = undefined;
    }

    verify({ quiet = false }) {
        let verified = true;
        const data = { ...this.objectified };
        // console.log(JSON.stringify(data, null, 2));
        if (data["schema:additionalType"] === "item") {
            if (!quiet) console.info(`Verifying item data structure`);
            const valid = ajv.validate(this.itemSchema, data);
            if (!valid) {
                logErrors(ajv.errors);
                throw new Error("Item crate did not verify");
            }
        } else if (data["schema:additionalType"] === "collection") {
            if (!quiet) console.info(`Verifying collection data structure`);
            const valid = ajv.validate(this.collectionSchema, data);
            if (!valid) {
                logErrors(ajv.errors);
                throw new Error("Collection crate did not verify");
            }
        } else {
            if (!quiet)
                console.error(
                    `Unknown input type - don't know how to handle this`
                );
        }
        return verified;

        function logErrors(errors) {
            if (quiet) return;
            verified = false;
            console.log("Errors:");
            errors.forEach(e => {
                console.error(`  - ${JSON.stringify(e, null, 2)}`);
                console.error("");
            });
        }
    }

    async objectify() {
        let data = await jsonld.expand(this.data);
        // console.log(JSON.stringify(data, null, 2));

        let root = data.filter(i => {
            if (i["@type"])
                return i["@type"].includes("http://schema.org/Dataset");
        })[0];
        let content = data.filter(i => {
            if (i["@type"])
                return !i["@type"].includes("http://schema.org/Dataset");
            return i;
        });
        // console.log(JSON.stringify(content, null, 2));

        let rootProperties = Object.keys(root);
        for (let property of rootProperties) {
            let item = root[property];
            if (isArray(item)) {
                item = mapContent({ property, item, content });
                root[property] = [...item];
            }
        }
        // console.log(JSON.stringify(root, null, 2));

        this.objectified = await compact(root);
        // console.log(JSON.stringify(this.objectified, null, 2));

        async function compact(root) {
            return await jsonld.compact(root, context, {
                base: null,
                // compactArrays: false,
                compactToRelative: true,
                skipExpansion: true
            });
        }

        function mapContent({ property, item, content }) {
            item = item.map(entry => {
                if (entry["@id"]) {
                    let entryData = content.filter(
                        c => c["@id"] === entry["@id"]
                    )[0];

                    if (entryData) {
                        let properties = Object.keys(entryData);
                        for (let prop of properties) {
                            if (isArray(entryData[prop]))
                                entryData[prop] = mapContent({
                                    property: prop,
                                    item: entryData[prop],
                                    content
                                });
                        }
                        entry = { ...entry, ...entryData };
                        if (!maintainIds.includes(property))
                            delete entry["@id"];
                    }
                }
                return entry;
            });
            return item;
        }
    }

    remap() {
        this.objectified.contributor = flattenContributor({
            contributor: this.objectified.contributor
        });

        function flattenContributor({ contributor }) {
            if (isPlainObject(contributor)) {
                contributor = [contributor];
            }
            contributor = contributor.map(c => {
                return {
                    name: c.contributor.name,
                    role: c.name
                };
            });
            return contributor;
        }
    }
}

module.exports = JSON_LOADER;

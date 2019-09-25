"use strict";

const { map, isArray, isObject } = require("lodash");
const jsonld = require("jsonld");
const Ajv = require("ajv");
const util = require("util");
const readFile = util.promisify(require("fs").readFile);
const ajv = new Ajv();

const maintainIds = [
    "http://pcdm.org/models#hasMember",
    "http://schema.org/memberOf",
    "http://schema.org/hasPart"
];

export class JSON_LOADER {
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

    verify() {
        let verified = true;
        const data = { ...this.objectified };
        // console.log(JSON.stringify(data, null, 2));
        if (data["schema:additionalType"] === "item") {
            console.info(`Verifying item data structure`);
            const valid = ajv.validate(this.itemSchema, data);
            if (!valid) logErrors(ajv.errors);
        } else if (data["schema:additionalType"] === "collection") {
            console.info(`Verifying collection data structure`);
            const valid = ajv.validate(this.collectionSchema, data);
            if (!valid) logErrors(ajv.errors);
        } else {
            console.error(`Unknown input type - don't know how to handle this`);
        }
        return verified;

        function logErrors(errors) {
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
        for (let prop of rootProperties) {
            let item = root[prop];
            if (isArray(item)) {
                item = mapContent({ item, content });
                root[prop] = [...item];
            }
        }
        // console.log(JSON.stringify(root, null, 2));

        this.objectified = await compact(root);

        async function compact(root) {
            return await jsonld.compact(
                root,
                {
                    "@context": "https://schema.org"
                },
                {
                    base: null,
                    // compactArrays: false,
                    compactToRelative: true,
                    skipExpansion: true
                }
            );
        }

        function mapContent({ item, content }) {
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
                                    item: entryData[prop],
                                    content
                                });
                        }
                        entry = { ...entry, ...entryData };
                        if (!maintainIds.includes(entry["@id"]))
                            delete entry["@id"];
                    }
                }
                return entry;
            });
            return item;
        }

        // map(objectRoot, (values, rootElement) => {
        //     if (isArray(values)) {
        //         values = values.map(v => {
        //             if (isObject(v) && v["@id"]) {
        //                 let element = content.filter(
        //                     c => c["@id"] === v["@id"]
        //                 )[0];
        //                 if (!maintainIds.includes(rootElement)) delete v["@id"];
        //                 if (element) delete element["@id"];
        //                 v = { ...v, ...element };
        //             }
        //             return v;
        //         });
        //     }
        //     root[rootElement] = values;
        // });
        // this.objectified = await jsonld.compact(root, {
        //     "@context": "http://schema.org"
        // });
        // // console.log(JSON.stringify(this.objectified, null, 2));
    }
}

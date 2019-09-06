"use strict";

const { map, isArray, isObject } = require("lodash");
const jsonld = require("jsonld");
const Ajv = require("ajv");
const util = require("util");
const readFile = util.promisify(require("fs").readFile);
const ajv = new Ajv();

class JSONLD_LOADER {
    constructor() {
        (async () => {
            this.itemSchema = JSON.parse(await readFile("./item.schema.json"));
            this.collectionSchema = JSON.parse(
                await readFile("./collection.schema.json")
            );
        })();
    }

    init({ path, name, data }) {
        this.path = path;
        this.name = name;
        this.data = data;
        this.objectified = undefined;
    }

    verify() {
        const data = { ...this.objectified };
        console.log(JSON.stringify(data, null, 2));
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

        function logErrors(errors) {
            console.log("Errors:");
            errors.forEach(e => console.error(`  - ${e.message}`));
        }
    }

    async objectify() {
        let data = (await jsonld.expand(this.data))[0]["@graph"];

        let objectRoot = data.filter(e => e["@id"] === "./")[0];
        let content = data.filter(e => e["@id"] !== "./");
        // console.log(objectRoot);

        let root = {};
        map(objectRoot, (values, rootElement) => {
            if (isArray(values)) {
                values = values.map(v => {
                    if (isObject(v) && v["@id"]) {
                        // console.log(v["@id"]);
                        let element = content.filter(
                            c => c["@id"] === v["@id"]
                        )[0];
                        // v = { ...v, ...element };
                        // console.log(element);
                        v = { ...v, ...element };
                    }
                    return v;
                });
            }
            root[rootElement] = values;
        });
        this.objectified = await jsonld.compact(root, {
            "@context": "http://schema.org"
        });
        // console.log(JSON.stringify(this.objectified, null, 2));
    }
}

module.exports = JSONLD_LOADER;

"use strict";

const JSON_LOADER = require("./jsonld-loader.js");
const loader = new JSON_LOADER();
const util = require("util");
const path = require("path");
const readFile = util.promisify(require("fs").readFile);

test("test COLLECTION-ro-crate-metadata.copy.jsonld can be objectified", async () => {
    const filename = "COLLECTION-ro-crate-metadata.copy.jsonld";
    const filepath = "./example-crates";
    let data = JSON.parse(await readFile(path.join(filepath, filename)));
    loader.init({ path: filepath, filename, data });
    await loader.objectify();
    expect(loader.objectified).toEqual({
        "@context": "https://schema.org",
        id: "./",
        type: ["Dataset", "http://pcdm.org/models#object"],
        "http://pcdm.org/models#hasMember": {
            id: "/paradisec.org.au/NT5/200501"
        },
        contentLocation: {
            type: "Place",
            geo: {
                type: "GeoShape",
                box: "168.31,-17.81 168.38,-17.75"
            },
            name: "Erakor, Lelepa"
        }
    });
});

test("test COLLECTION-ro-crate-metadata.jsonld verifies", async () => {
    const filename = "COLLECTION-ro-crate-metadata.jsonld";
    const filepath = "./example-crates";
    let data = JSON.parse(await readFile(path.join(filepath, filename)));
    loader.init({ path: filepath, filename, data });
    await loader.objectify();
    expect(() => {
        loader.verify({ quiet: true });
    }).not.toThrow();
});

test("test COLLECTION-ro-crate-metadata.jsonld does not verify", async () => {
    const filename = "COLLECTION-ro-crate-metadata.jsonld";
    const filepath = "./example-crates";
    let data = JSON.parse(await readFile(path.join(filepath, filename)));
    loader.init({ path: filepath, filename, data });
    await loader.objectify();
    loader.objectified.id = "/";
    expect(() => {
        loader.verify({ quiet: true });
    }).toThrow();
});

test("test ITEM-ro-crate-metadata.jsonld verifies", async () => {
    const filename = "ITEM-ro-crate-metadata.jsonld";
    const filepath = "./example-crates";
    let data = JSON.parse(await readFile(path.join(filepath, filename)));
    loader.init({ path: filepath, filename, data });
    await loader.objectify();
    expect(() => {
        loader.verify({ quiet: true });
    }).not.toThrow();
});

test("test ITEM-ro-crate-metadata.jsonld does not verify", async () => {
    const filename = "ITEM-ro-crate-metadata.jsonld";
    const filepath = "./example-crates";
    let data = JSON.parse(await readFile(path.join(filepath, filename)));
    loader.init({ path: filepath, filename, data });
    await loader.objectify();
    loader.objectified.id = "/";
    expect(() => {
        loader.verify({ quiet: true });
    }).toThrow();
});

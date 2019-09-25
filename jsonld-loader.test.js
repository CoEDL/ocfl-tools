"use strict";

import { JSON_LOADER } from "./jsonld-loader.js";
const loader = new JSON_LOADER();
import util from "util";
import path from "path";
import { exportAllDeclaration } from "@babel/types";
const readFile = util.promisify(require("fs").readFile);

test("test COLLECTION-ro-crate-metadata.copy.jsonld", async () => {
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

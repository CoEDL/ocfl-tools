"use strict";

const yargs = require("yargs");
const walk = require("walk");
const util = require("util");
const readFile = util.promisify(require("fs").readFile);
const rp = require("request-promise-native");
const path = require("path");
const JSON_LOADER = require("./jsonld-loader");

const args = yargs.scriptName("OCFL Indexer").options({
    source: {
        demandOption: true,
        describe: "The path to the OCFL filesystem to index",
        type: "string"
    },
    search: {
        demandOption: true,
        describe: "the URL to the elastic search service",
        type: "string"
    }
}).argv;

let walker = walk.walk(args.source, {});

const loader = new JSON_LOADER();
walker.on("file", async (root, fileStats, next) => {
    if (fileStats.name == "ro-crate-metadata.jsonld") {
        console.info();
        console.info(`Processing: ${path.join(root, fileStats.name)}`);
        let data = await readFile(path.join(root, fileStats.name));
        data = JSON.parse(data);
        // console.log(root, fileStats.name);
        loader.init({
            path: root,
            name: fileStats.name,
            data
        });
        await loader.objectify();
        loader.verify();
    }
    next();
});
walker.on("errors", (root, nodeStatsArray, next) => {
    next();
});

walker.on("end", () => {});

// (async () => {
//     let path = `myindex `;
//     const options = {
//         auth: {
//             user: "indexer",
//             pass: "somerandompassword"
//         },
//         uri: `${args.search}/${path}`,
//         method: "PUT"
//     };
//     return await rp(options);
// })();

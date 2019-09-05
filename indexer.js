"use strict";

const yargs = require("yargs");
const walk = require("walk");
const util = require("util");
const readFile = util.promisify(require("fs").readFile);
const rp = require("request-promise-native");

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

// let walker = walk.walk(args.source, {});

// walker.on("file", (root, fileStats, next) => {
//     console.log(root, fileStats.name);
//     next();
// });
// walker.on("errors", (root, nodeStatsArray, next) => {
//     next();
// });

// walker.on("end", () => {
//     console.log("done");
// });

(async () => {
    let path = `myindex `;
    const options = {
        auth: {
            user: "indexer",
            pass: "somerandompassword"
        },
        uri: `${args.search}/${path}`,
        method: "PUT"
    };
    return await rp(options);
})();

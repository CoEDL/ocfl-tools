"use strict";

const yargs = require("yargs");
const walk = require("walk");
const util = require("util");
const readFile = util.promisify(require("fs").readFile);
const rp = require("request-promise-native");
const path = require("path");
const JSON_LOADER = require("./jsonld-loader");
const { Client } = require("@elastic/elasticsearch");
const { mappings } = require("./mappings");

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
    },
    username: {
        demandOption: true,
        describe: "The username to log in to elastic with",
        type: "string"
    },
    password: {
        demandOption: true,
        describe: "The password to log in to elastic with",
        type: "string"
    }
}).argv;

const elasticClient = new Client({
    node: args.search,
    auth: {
        username: args.username,
        password: args.password
    }
});
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
        data = loader.objectified;
        await createIndexAndLoadMapping({ data });
        // console.log(data);
    }
    next();
});
walker.on("errors", (root, nodeStatsArray, next) => {
    next();
});

walker.on("end", () => {});

async function createIndexAndLoadMapping({ data }) {
    let domain = data.identifier.filter(d => d.name === "domain")[0].value;
    try {
        let index = await elasticClient.indices.get({ index: domain });
    } catch (error) {
        await elasticClient.indices.create({ index: domain });
        await elasticClient.indices.putMapping({
            index: domain,
            body: mappings
        });
        // no such index - create it
    }
    //     await elasticClient.index({
    //         index: 'game-of-thrones',
    //         // type: '_doc', // uncomment this line if you are using Elasticsearch ≤ 6
    //         body: {
    //           character: 'Daenerys Targaryen',
    //           quote: 'I am the blood of the dragon.'
    //         }
    //       })
}

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

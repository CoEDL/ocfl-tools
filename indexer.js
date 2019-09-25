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
        if (!loader.verify({ quiet: false })) {
            console.error(`Crate didn't verify - skipping indexing.`);
        } else {
            data = loader.objectified;
            await createIndexAndLoadMapping({ data });
            await indexDocument({ data });
        }
        // console.log(data);
    }
    next();
});
walker.on("errors", (root, nodeStatsArray, next) => {
    next();
});

walker.on("end", () => {});

async function createIndexAndLoadMapping({ data }) {
    let index = data.identifier
        .filter(d => d.name === "domain")[0]
        .value.toLowerCase();
    try {
        await elasticClient.indices.get({ index });
    } catch (error) {
        await elasticClient.indices.create({ index });
        await elasticClient.indices.putMapping({
            index,
            body: mappings
        });
    }
}

async function indexDocument({ data }) {
    let index = data.identifier
        .filter(d => d.name === "domain")[0]
        .value.toLowerCase();
    let id = data.identifier.filter(d => d.name === "hashId")[0].value;
    console.info(`Indexing as ${index}/${id}`);
    await elasticClient.index({ id, index, body: data });
}

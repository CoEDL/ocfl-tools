"use strict";

module.exports = {
    mappings: {
        properties: {
            "schema:additionalType": { type: "keyword" },
            "@context": { enabled: false },
            type: { enabled: false },
            id: { enabled: false },
            name: { type: "text" },
            description: { type: "text" },
            "schema:dateCreated": { type: "date" },
            "schema:dateModified": { type: "date" },
            author: {
                type: "nested",
                properties: {
                    name: { type: "keyword" }
                }
            },
            contributor: {
                type: "nested",
                properties: {
                    name: { type: "keyword" },
                    role: { type: "keyword" }
                }
            },
            identifier: {
                type: "nested",
                properties: {
                    name: { type: "keyword" },
                    value: { type: "keyword" }
                }
            },
            hasPart: {
                type: "nested",
                properties: {
                    duration: { type: "long" },
                    contentSize: { type: "long" },
                    bitrate: { type: "integer" },
                    encodingFormat: { type: "keyword" },
                    "schema:dateCreated": { type: "date" },
                    "schema:dateModified": { type: "date" }
                }
            },
            publisher: {
                type: "nested",
                properties: {
                    name: { type: "keyword" }
                }
            },
            contentLocation: {
                type: "nested",
                properties: {
                    geo: { type: "geo_shape" }
                }
            }
        }
    }
};

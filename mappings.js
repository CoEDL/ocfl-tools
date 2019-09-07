"use strict";

module.exports = {
    mappings: {
        properties: {
            name: { type: "text" },
            description: { type: "text" },
            author: {
                type: "nested",
                properties: {
                    name: { type: "keyword" }
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
                    encodingFormat: { type: "keyword" }
                }
            }
        }
    }
};

"use strict";

module.exports = {
    mappings: {
        properties: {
            "schema:additionalType": { type: "keyword" },
            name: { type: "text" },
            description: { type: "text" },
            dateCreated: { type: "date" },
            dateModified: { type: "date" },
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
                    encodingFormat: { type: "keyword" },
                    dateCreated: { type: "date" },
                    dateModified: { type: "date" }
                }
            }
        }
    }
};

# Elastic search index mappings

-   [Elastic search index mappings](#elastic-search-index-mappings)
    -   [Folder layout](#folder-layout)
    -   [Adding a new validator](#adding-a-new-validator)
        -   [Are you adding a generic domain validator to be run over all crates from a specific domain?](#are-you-adding-a-generic-domain-validator-to-be-run-over-all-crates-from-a-specific-domain)
        -   [Are you adding a type specific validator for a domain?](#are-you-adding-a-type-specific-validator-for-a-domain)

## Folder layout

The mappings in this folder are arranged as follows.

In the top level there is a single mapping file: `mappings.json`. This mapping tells elastic how to handle incoming data and in the absence of a domain specific mapping, this will be loaded in to new indices.

## Adding a doman specific mapping

-   Create a folder named as the domain in `indexer/mappings`
-   Create a file `mappings.json` in that folder.

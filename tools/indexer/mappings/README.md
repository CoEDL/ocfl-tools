# Elastic search index mappings

-   [Elastic search index mappings](#elastic-search-index-mappings)
    -   [Folder layout](#folder-layout)
    -   [Adding a doman specific mapping](#adding-a-doman-specific-mapping)

## Folder layout

The mappings in this folder are arranged as follows.

In the top level there is a single mapping file: `mappings.json`. This mapping tells elastic how to handle incoming data and in the absence of a domain specific mapping, this will be loaded in to new indices.

## Adding a doman specific mapping

-   Create a folder named as the domain in `indexer/mappings`
-   Create a file `mappings.json` in that folder.

Domain specific mappings will be chosen in `preference` to the generic mapping.

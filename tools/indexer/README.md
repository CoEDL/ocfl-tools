# OCFL indexer

## About

This tool will walk an OCFL filesystem lookup for objects that have an `RO-Crate` inside as identifier by the presence of a
file named `ro-crate-metadata.jsonld`. When a crate is located the object is loaded and then submitted to the indexer.

## Running it

```
./node_modules/.bin/babel-node ocfl-tools.js indexer \
    --search http://localhost:9200 \
    --username indexer \
    --password somerandompassword \
    --source /path/to/ocfl-repository \
    --log-level=info
```

Things to note:

-   ensure `source` is always a fully qualified path - relative paths will fail
-   supported log levels: debug, info, warn and error. Default is warn.

## Running against a specific crate

```
./node_modules/.bin/babel-node ocfl-tools.js indexer \
    --search http://localhost:9200 \
    --username indexer \
    --password somerandompassword \
    --log-level=debug \
    --source $PWD/test-data
    --path-to-object ocfl-object-5
```

Things to note:

-   ensure `source` is always a fully qualified path - relative paths will fail.
-   `path-to-object` must be the full path relative to the `source` (the OCFL root.)

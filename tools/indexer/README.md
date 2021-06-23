# OCFL indexer

- [OCFL indexer](#ocfl-indexer)
  - [About](#about)
  - [Mappings](#mappings)
  - [Running it](#running-it)
  - [Running against a specific crate](#running-against-a-specific-crate)

## About

This tool will walk an OCFL filesystem lookup for objects that have an `RO-Crate` inside as identifier by the presence of a file named `ro-crate-metadata.jsonld`. When a crate is located the object is loaded and then submitted to the indexer.

## Mappings

Elastic search has a concept of [mappings](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html). From the docs: `Mapping is the process of defining how a document, and the fields it contains, are stored and indexed`.

Depending on the data coming you may want to provide mappings defining how it is to be indexed. In this case you can add domain specific mappings to the indexer for that data. See [here](./mappings/README.md) for information on how to do that.

<!-- ## Transformers

As with mappings, domain specific data may need to be transformed before indexing. See [here](./transformers/README.md) for information on how to do that. -->

## Running it

```
node . --config /path/to/configfile

To change the log level:
node . --config /path/to/configfile --log-level debug
```

Things to note:

-   ensure `source` is always a fully qualified path - relative paths will fail
-   supported log levels: debug, info, warn and error. Default is warn.

## Running against a specific crate

```
node . --config /path/to/configfile --id {id of OCFL object}

To change the log level:
node . --config /path/to/configfile --id {id of OCFL object} --log-level debug
```

Things to note:

-   ensure `source` is always a fully qualified path - relative paths will fail.
-   `id` must be the id of the object you want to use - not the pairtree path

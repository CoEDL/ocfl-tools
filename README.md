# OCFL-indexer

- [OCFL-indexer](#ocfl-indexer)
  - [About](#about)
  - [Data Validation](#data-validation)
  - [Important](#important)
  - [Running the indexer in development](#running-the-indexer-in-development)
  - [Running the tests](#running-the-tests)

## About

The indexer is a small node application that walks the OCFL filesystem looking for files named `ro-crate-metadata.jsonld`. When it finds it one it reads the content and unflattens it (reverses the JSON-ld flattening to return an object) before passing it through a schema validator to ensure that the information required for this application to work has been defined.

## Data Validation

In order to ensure that the data is going to work with this application it is first validated against a schema that defines how it should look and what is required. To determine which schema to load the data must contain a property `schema:additionalType` set to `collection` or  `item`.

The collection schema file is `collection.schema.json` whilst the item schema file is `item.schema.json`. Consult the schema's to see what is required and how it is required to be defined.

## Important
In both instances, the indentifier must have `PropertyValues` set as follows:
 * `domain`: the domain of the data - e.g. paradisec.org.au. This is used as the index name in which to ingest the data.
 * `id`: the ID of the item as a domain path - e.g. paradisec.org.au/NT11 (collection) or paradisec.org.au/NT11/001 (item)
 * `hashId`: the SHA256 hash of the id.
 * `collectionIdentifier`: the collection ID - e.g. NT11
 * `itemIdentifier`: the item ID - e.g. 001. Applies only to items.
  
If an RO-Crate doesn't verify, the errors will be printed and the crate will not be indexed.

## Running the indexer in development

When the development cluster starts the elastic service will be empty. To populate it run the following command:

```
>  node indexer.js \
    --source ../ocfl-repository \
    --search http://localhost:9200 \
    --username indexer \
    --password somerandompassword
```

In development, the elastic service is configured with a user `indexer` that has superuser access to the service with a password of `somerandompassword`.

## Running the tests

Tests need to run inside the a linux container so you first need to start it.

```
> docker-compose up -d
```

The first time, install the modules, viz:
```
> ./run-tests.sh --install
```

After that (assuming you haven't added any tests):
```
> ./run-tests.sh
```
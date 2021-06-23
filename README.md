# OCFL-Tools

- [OCFL-Tools](#ocfl-tools)
  - [About](#about)
  - [Setup](#setup)
  - [Developing the tools](#developing-the-tools)
  - [Adding a new tool](#adding-a-new-tool)
    - [Tool Readme](#tool-readme)
  - [Running the tests](#running-the-tests)
  - [Minimum requirements of an RO-Crate](#minimum-requirements-of-an-ro-crate)

## About

This repository contains a set of tools for working with, interacting with and manipulating OCFL objects in a repository.

## Setup

Ensure you run `npm install` before doing anything else.

## Developing the tools

Developing the tools first requires that you start the required docker containers. This is done via `docker-compose up -d`.

## Adding a new tool

-   Create a folder in `./tools` named as the tool
-   Create your tool. Follow `indexer` for an example.

See [http://yargs.js.org/docs/](http://yargs.js.org/docs/) for option documentation.

### Tool Readme

Each tool should have it's own README.md that describes how to use it and any other information pertinent to that tool.

## Running the tests

Start and elastic search docker container:

```
> docker compose up -d
```

Run the tests

```
> npm run tests
```

OR Run the tests in watch mode

```
> npm run test:watch
```

Shut down the elastic container

```
> docker compose stop
> docker compose rm -f
```

## Minimum requirements of an RO-Crate

At a minimum, in order for an RO-Crate to be useable by this code it must have the following properties:

```
  -   @id = './'
  -   name = string
  -   description = string
  -   identifier = [
        { @type = "PropertyValue", name = 'domain', value = domain name of data without / },
        {
            @type = "PropertyValue", name = 'id', value = identifier of the thing described by the crate
                IMPORTANT: the id must also include the domain and it must be a valid URL path
                    e.g. /{domain}/{id}

        },
        { @type = "Property Value", name = 'hashId', value = the SHA512 encoded 'id' },
      ]
```

Following is an example, flattened crate:

```
{
    "@context": "https://w3id.org/ro/crate/1.0/context",
    "@graph": [
        {
            "@id": "./",
            "@type": ["Dataset", "RepositoryObject"],
            "name": "My Dataset",
            "description": "The best data ever collected!",
            "identifier": [
                {"@id": "_:b1"},
                {"@id": "_:b2"},
                {"@id": "_:b3"},
            ],
        },
        {
            "@id": "_:b1",
            "@type": "PropertyValue",
            "name": "domain",
            "value": "paradisec.org.au
        }
        {
            "@id": "_:b2",
            "@type": "PropertyValue",
            "name": "id",
            "value": "/paradisec.org.au/AC1/001"
        },
        {
            "@id": "_:b3",
            "@type": "PropertyValue",
            "name": "hashId",
            "value": "7C86FB6C455BD522519E597A6B69B63CB5752E13E5658489C27F64CE9ED7A0E68F90DCE7BDE727BDAB4F3E059D46F78125BDFAE859A7FDA09250644765168C66"
        },
        {
            "@id": "ro-crate-metadata.jsonld",
            "@type": "CreativeWork",
            "about": {"@id": "./"},
            "identifier": "ro-crate-metadata.jsonld",
            "license": {"@id": "https://creativecommons.org/licenses/by-sa/3.0"}
        }
    ]
}

```

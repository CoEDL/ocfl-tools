# OCFL-Tools

-   [OCFL-Tools](#ocfl-tools)
    -   [About](#about)
    -   [Setup](#setup)
    -   [Developing the tools](#developing-the-tools)
    -   [Adding a new tool](#adding-a-new-tool)
    -   [Getting to the tool help](#getting-to-the-tool-help)
        -   [Tool Readme](#tool-readme)
    -   [Running the tests](#running-the-tests)
    -   [Minimum requirements of an RO-Crate](#minimum-requirements-of-an-ro-crate)

## About

This repository contains a set of tools for working with, interacting with and manipulating OCFL objects in a repository.

The over-arching tool `ocfl-tools.js` is the parent of a set of subcommands that each have their own code and configuration in the `tools` folder. See the individual README.md files in the tool folders for information about that specific tool.

## Setup

Ensure you run `npm install` before doing anything else.

## Developing the tools

Developing the tools first requires that you start the required docker containers. This is done via `docker-compose up -d`.

## Adding a new tool

-   Create a folder in `./tools` named as the tool
-   Add an `index.js` that exports an object like:
    ```
    module.exports = {
      command: 'validate-crate',
      description: 'Validate an RO-Crate',
      builder: {
          'path-to-object': {
              demandOption: true,
              describe:
                  'The path to a single OCFL object containing an RO-Crate.',
              type: 'string',
          },
      },
      handler: async args => {
          // the code for the tool
      },
    }
    ```
-   Look at `tools/validate-crate` for a simple example and `tools/indexer` for a more complex, multiprocessing example.

See [http://yargs.js.org/docs/](http://yargs.js.org/docs/) for option documentation.

## Getting to the tool help

To see the help for the parent tool run:

```
./node_modules/.bin/babel-node ocfl-tools.js --help
```

And to see the help for a specific tool (e.g. the indexer)

```
./node_modules/.bin/babel-node ocfl-tools.js indexer --help
```

### Tool Readme

Each tool should have it's own README.md that describes how to use it and any other information pertinent to that tool.

## Running the tests

```
> npm run tests
```

OR to get a coverage report

```
> npm run tess-with-coverage
```

OR to do it via a GUI

```
> npm run majestic
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

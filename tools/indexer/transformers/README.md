# Data Transformers

-   [Data Transformers](#data-transformers)
    -   [Preamble](#preamble)
    -   [Adding a doman specific transformer](#adding-a-doman-specific-transformer)

## Preamble

Indexing domain specific data in a particular way may require some transformation of that data. In this case, you can provide a custom transformer to masage the data in to the form required.

## Adding a doman specific transformer

-   Create a folder named as the domain in `indexer/transformers`
-   Create a file `index.js` in that folder.
-   Export a single method `transformer` with a signature as follows:

```
function transformer({data}) {}
```

-   The transformer will be passed the `objectifiedCrate` as the data property and the transformer must return the data object

See `transformers/paradisec.org.au/index.json` for an example.

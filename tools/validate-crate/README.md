# Validate Crate

## About

This tool will validate an `RO-Crate` inside an OCFL object against the JSON validation schema in `json-validation-schema`.

## Running it

```
./node_modules/.bin/babel-node ocfl-tools.js validate-crate \
    --source /path/to/ocfl-repository \
    --path-to-object /path/to/object/relative/{source} \
    --log-level debug
```

Things to note:

-   ensure `source` is always a fully qualified path - relative paths will fail

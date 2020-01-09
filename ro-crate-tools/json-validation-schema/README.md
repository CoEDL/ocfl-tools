# JSON schema validators

-   [JSON schema validators](#json-schema-validators)
    -   [Folder layout](#folder-layout)
    -   [Adding a new validator](#adding-a-new-validator)
        -   [Are you adding a generic domain validator to be run over all crates from a specific domain?](#are-you-adding-a-generic-domain-validator-to-be-run-over-all-crates-from-a-specific-domain)
        -   [Are you adding a type specific validator for a domain?](#are-you-adding-a-type-specific-validator-for-a-domain)

## Folder layout

The validators in this folder are arranged as follows.

In the top level there is a single validator `schema.json`. This validator defines the absolute bare minimum of properties an RO-Crate **MUST** define for it to be considered valid `by this tool` (note that this is likely different to what the spec requires for a crate to be valid). `All crates are verified using this validator so it is intentionally small and simple.`

If you wish to verify domain specific content, add a folder named as the domain of the content and in there create the validators as required to match the content. Alternately, you can again provide a generic validator for a given domain named as `schema.json` within the domain specific folder.

Note that the specific validators don't need to check the properties being checked by the generic validator as the generic validator is run `over all crates`.

## Adding a new validator

### Are you adding a generic domain validator to be run over all crates from a specific domain?

-   Create a folder named as the domain in `json-validation-schema`
-   Create a file `schema.json` in that folder.

### Are you adding a type specific validator for a domain?

-   Create a folder named as the domain in `json-validation-schema`
-   Create your new validator names as `${additionalType}.schema.json` in that folder.

The code will use the `domain` and `additionalType` properties to load this specific validator. So, using the paradisec example, if your crate has a type `item` and you wish to validate its structure then you would create a validator `json-validation-schema/paradisec.org.au/item.schema.json`. Whenever the tools encounter an RO-Crate with `domain = paradisec.org.au` and `additionalType = item` this validator will be run over the crate to ensure it's structured as expected.

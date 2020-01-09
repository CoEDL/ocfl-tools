'use strict';

const CRATE_TOOLS = require(`../../ro-crate-tools`);

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
        let crateTools = new CRATE_TOOLS({
            ocflRoot: args.source,
            objectPath: args.pathToObject,
        });
        let {
            flattenedCrate,
            objectifiedCrate,
        } = await crateTools.loadLatestCrate();
        const verbose = args.logLevel === 'debug' ? true : false;
        let {valid, domain} = await crateTools.validate({verbose});
        if (valid) {
            // validate domain in appropriate form.
            [...domain].forEach(c => {
                if (
                    [
                        ' ',
                        '"',
                        '*',
                        '\\',
                        '<',
                        '|',
                        ',',
                        '>',
                        '/',
                        '?',
                    ].includes(c)
                ) {
                    valid = false;
                    console.log(
                        `Domain property contains an invalid character "${c}": ${domain}`
                    );
                }
            });

            if (valid) {
                console.log('Crate is valid');
            }
        }
    },
};

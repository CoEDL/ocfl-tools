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
        try {
            let {
                flattenedCrate,
                objectifiedCrate,
            } = await crateTools.loadLatestCrate();
        } catch (error) {
            console.error(error.message);
            process.exit();
        }
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
                    console.error(
                        ` * "domain" property contains an invalid character "${c}": ${domain}`
                    );
                }
            });

            // validate hashId is SHA512 hash
            const hashId = objectifiedCrate.identifier.filter(
                i => i.name[0] === 'hashId'
            )[0].value[0];
            if (hashId.length !== 128) {
                valid = false;
                console.error(
                    ` * "hashId" property does not seem correct. Is it a SHA512 hash?`
                );
            }

            if (valid) {
                console.info('Crate is valid');
            }
        }
    },
};

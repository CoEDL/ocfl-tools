const yargs = require('yargs');
const {readdirSync} = require('fs');
const path = require('path');

const toolsPath = './tools';
const tools = readdirSync(toolsPath);
const numberOfWalkers = require('os').cpus().length * 4;

var args = yargs.options({
    source: {
        demandOption: true,
        describe: 'The path to the OCFL filesystem to index',
        type: 'string',
    },
    'log-level': {
        describe: 'Turn on logging',
        type: 'string',
        default: 'warn',
        choices: ['debug', 'info', 'warn', 'error'],
    },
});

let command;
tools.forEach(tool => {
    let p = path.join(toolsPath, tool, 'index.js');
    yargs.command(require(`./${p}`));
});

args.help().argv;

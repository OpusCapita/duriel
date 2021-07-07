'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');


module.exports = async function(compose_base, addition) {
    const command = `${compose_base} ${addition}`;
    log.info(`executing command: ${command}`);
    const proxy = new EnvProxy();
    return await proxy.executeCommand_L(command); // Promise of command-answer
};

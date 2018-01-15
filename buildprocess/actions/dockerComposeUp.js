'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');


module.exports =async function (composeCommand) {
    composeCommand = composeCommand + "up -d";
    log.info(`compose command: ${composeCommand}`);
    const proxy = new EnvProxy();
    return await proxy.executeCommand_L(composeCommand); // Promise of command-answer
};

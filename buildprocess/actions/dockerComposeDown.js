'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');


module.exports = async function (composeCommand) {
    log.info("docker-compose down!")
    composeCommand = composeCommand + "down";
    const proxy = new EnvProxy();
    return await proxy.executeCommand_L(composeCommand); // Promise of command-answer
};

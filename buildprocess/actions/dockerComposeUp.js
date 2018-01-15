'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');


module.exports = function () {
    log.info("building compose command:");
    let command = "composeCommand -f docker-compose.yml";
    if (fs.existsSync("./docker-compose.ci.yml")) {
        log.info("docker-compose.ci.yml exists");
        command += " -f docker-compose.ci.yml";
    } else {
        log.info("no docker-compose.ci.yml - using docker-compose.yml");
    }
    command = command + "up -d";
    log.info(`compose command: ${command}`);

    const proxy = new EnvProxy();
    return proxy.executeCommand_L(command); // Promise of command-answer
};

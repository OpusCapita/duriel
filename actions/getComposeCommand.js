'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const fs = require('fs');


module.exports = function () {
    log.info("building compose command:");
    let command = "composeCommand -f docker-compose.yml";
    if (fs.existsSync("./docker-compose.ci.yml")) {
        log.info("docker-compose.ci.yml exists");
        command += " -f docker-compose.ci.yml";
    } else {
        log.info("no docker-compose.ci.yml - using docker-compose.yml");
    }
    log.info(`compose-command is ${command}`);
    return command;
};
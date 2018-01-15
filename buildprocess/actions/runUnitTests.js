'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');
const fs = require('fs');


module.exports = async function (composeCommand) {
    if(!fs.existsSync("./package.js")){
        log.info("no package.js - skipping npm based unit testing.")
        return;
    }
    composeCommand += "exec main npm run test";
    const proxy = new EnvProxy();
    return proxy.executeCommand_L(composeCommand)
        .catch(error => {
            log.error("unit tests unsuccessfully.");
            log.error(error);
            // TODO: copy test-result.xml from container into artifacts/test-result.xml
            // docker copy?
        })


};

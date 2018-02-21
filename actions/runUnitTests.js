'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const fs = require('fs');


module.exports = async function (composeCommand) {
    if (!fs.existsSync("./package.js")) {
        log.info("no package.js - skipping npm based unit testing.");
        return;
    }
    composeCommand += "exec main npm run test";
    const proxy = new EnvProxy();
    try {
        const testResult = await  proxy.executeCommand_L(composeCommand);
        log.info("test successful:", testResult);

    } catch (error) {
        log.error("unit tests unsuccessfully.");
        log.error(error);

        const artifactDir = 'artifact';
        const resultFile = 'test-results.xml';

        await proxy.createFolder_L(artifactDir);
        let containers = await proxy.getContainers_L();
        containers = containers.filter(it => it.name.includes("_main"));
        for (let it of containers) {    // should be only one, but ...
            log.info(JSON.stringify(it));
            await proxy.createFolder_L(`${artifactDir}/${it.name}`);
            await proxy.executeCommand_L(`docker exec ${it.name} cat ${resultFile} >> ${artifactDir}/${it.name}/${resultFile}`);    // docker cp would be better
        }
    }
};

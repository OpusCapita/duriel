'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const fs = require('fs');


module.exports = async function (composeCommand) {
    log.info(`running unit tests.`);
    if (!fs.existsSync("./package.json")) {
        log.info("no package.js - skipping npm based unit testing.");
        return;
    }
    composeCommand += " exec -T main npm run test";
    const proxy = new EnvProxy();
    try {
        log.debug(await proxy.executeCommand_L(composeCommand));
        log.info("unit tests successful.");
    } catch (error) {
        log.error("unit tests unsuccessfully.", error);
        await copyTestResult(proxy);
    }
};

async function copyTestResult(proxy){
    const artifactDir = 'artifacts';
    const resultFile = 'test-results.xml';

    await proxy.createFolder_L(artifactDir);
    let containers = await proxy.getContainers_L();
    containers = containers.filter(it => it.name.includes("_main"));
    for (let it of containers) {
        await proxy.createFolder_L(`${artifactDir}`);
        await proxy.executeCommand_L(`docker exec ${it.name} cat ${resultFile} >> ${artifactDir}/${resultFile}`);    // docker cp would be better
    }
}

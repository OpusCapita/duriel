'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const fs = require('fs');


module.exports = async function (composeBase) {
    log.info(`running unit tests.`);
    if (!fs.existsSync("./package.json")) {
        log.info("no package.js - skipping npm based unit testing.");
        return;
    }
    const proxy = new EnvProxy();
    try {
        log.debug(await proxy.executeCommand_L(`${composeBase} exec -T main npm run test`));
        log.info("unit tests successful.");
        await copyTestResult(proxy, composeBase);
    } catch (error) {
        log.error("unit tests unsuccessfully.", error);
    }
};

async function copyTestResult(proxy, composeBase) {
    const artifactDir = 'artifacts';
    const resultFile = 'test-results.xml';

    await proxy.createFolder_L(`${artifactDir}`);
    await proxy.executeCommand_L(`${composeBase} exec main cat ${resultFile} >> ${artifactDir}/local_${resultFile}`);    // docker cp would be better
}

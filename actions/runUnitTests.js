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
    try {
        const packageJson = require('./package.json');
        const testScript = packageJson.scripts.test;
        if(!testScript){
            log.warn("no test-script insode of package.json");
            return;
        }
    } catch (e) {
        log.warn("error during loading of test-script", e);
    }

    const proxy = new EnvProxy();
    try {
        log.debug(await proxy.executeCommand_L(`${composeBase} exec -T main npm run test`));
        log.info("unit tests successful.");
        await copyTestResult(proxy, composeBase);
    } catch (error) {
        log.error("unit tests unsuccessfully.");
            await copyTestResult(proxy, composeBase)
                .catch(error => log.warn("could not copy test-results: ", error));
        throw error;
    }
};

async function copyTestResult(proxy, composeBase) {
    const artifactDir = 'junit';
    const resultFile = 'test-results.xml';
    await proxy.createFolder_L(`${artifactDir}`);
    await proxy.executeCommand_L(`${composeBase} exec -T main cat ${resultFile} >> ${artifactDir}/local-${resultFile}`);    // docker cp would be better
}

/**
 * Action to execute Unit-Tests
 * @module
 */
'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const fs = require('fs');
const fileHandler = require('./filehandling/fileHandler');

/**
 *Execute the Unit-Tests of a service
 * @param composeBase {string} e.g. 'docker-compose -d -f docker-compose.yml'
 * @returns {Promise<void>}
 */
module.exports = async function (composeBase) {
    log.info(`running unit tests.`);
    if (!fs.existsSync("./package.json")) {
        log.info("no package.js - skipping npm based unit testing.");
        return;
    }
    try {
        const packageJson = await fileHandler.loadFile2Object("./package.json");
        if(!packageJson || !packageJson.scripts || !packageJson.scripts.test){
            log.warn("could not find 'test'-script - skipping tests", e);
            return;
        }
    } catch (e) {
        log.warn("error while checking to 'test'-script: ", e);
        return;
    }

    const proxy = new EnvProxy();
    try {
        log.debug(await proxy.executeCommand_L(`${composeBase} exec -T main npm run test`));
        log.info("unit tests successful.");
        await copyTestResult(proxy, composeBase)
            .catch(error => log.warn("could not copy test-results: ", error));
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

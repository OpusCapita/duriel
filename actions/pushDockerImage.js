'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

module.exports = async function (config) {
    log.info("pushing to docker...");
    const proxy = new EnvProxy();
    log.info(`adding tag 'latest' to image`);
    log.info(`adding tag '${config['VERSION']}' to image`);
    await proxy.executeCommand_L(`docker tag ${config['HUB_REPO']}:latest ${config['HUB_REPO']}:${config['VERSION']}`);
    log.info(`pushing...`);
    await proxy.executeCommand_L(`docker push ${config['HUB_REPO']}:latest `);
    log.info("...finished pushing docker image")
};
'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');

module.exports = async function (config) {
    const proxy = new EnvProxy();
    await proxy.executeCommand_L(`docker tag ${config['HUB_REPO']}:latest ${config['HUB_REPO']}:${config['VERSION']}`);
    await proxy.executeCommand_L(`docker push ${config['HUB_REPO']}:latest `);

};
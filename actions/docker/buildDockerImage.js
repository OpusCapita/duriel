'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');
const dockerHelper = require('../helpers/dockerHelper');

module.exports = async function (config) {
    const proxy = new EnvProxy();
    await dockerHelper.loginLocal(config);
    log.info("building actual image...");
    await proxy.executeCommand_L(`docker build -t ${config['HUB_REPO']}:latest -t ${config['HUB_REPO']}:dev --build-arg CI=true .`);
    log.info('... finished');
};

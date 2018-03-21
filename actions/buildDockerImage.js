'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const dockerLogin = require('./dockerLogin');

module.exports = async function (config) {
    const proxy = new EnvProxy();
    await dockerLogin(config);
    log.info("building actual image...");
    await proxy.executeCommand_L(`docker build -t ${config['HUB_REPO']}:latest -t ${config['HUB_REPO']}:dev --build-arg CI=true .`);
    log.info('... finished');
};

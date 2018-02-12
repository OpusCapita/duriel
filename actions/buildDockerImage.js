'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

module.exports = async function (config) {
    const proxy = new EnvProxy();
    log.info('building docker image ... ');
    log.info("login into docker...");
    await proxy.executeCommand_L(`docker login -u ${config['DOCKER_USER']} -p ${config['DOCKER_PASS']}`, true);
    log.info("building actual image...");
    await proxy.executeCommand_L(`docker build -t ${config['HUB_REPO']}:later -t ${config['HUB_REPO']}:dev --build-arg CI=true .`);
    log.info('... finisched');
};
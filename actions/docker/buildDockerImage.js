'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');
const dockerHelper = require('../helpers/dockerHelper');

async function buildBaseImage(config){
    const proxy = new EnvProxy();
    await dockerHelper.loginLocal(config);
    log.info("building base image...");
    await proxy.executeCommand_L(`docker build -t ${config['HUB_REPO']}:base -f Dockerfile.base .`, "docker build");
    log.info('... finished');
}

async function buildImage(config) {
    const proxy = new EnvProxy();
    await dockerHelper.loginLocal(config);
    log.info("building image...");
    await proxy.executeCommand_L(`docker build -t ${config['HUB_REPO']}:latest -t ${config['HUB_REPO']}:dev --build-arg CI=true .`, "docker build");
    log.info('... finished');
}

module.exports = {
    buildImage: buildImage,
    buildBaseImage: buildBaseImage
};

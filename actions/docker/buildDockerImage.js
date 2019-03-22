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
    if(config["MULTI_STAGE"]){
        await proxy.executeCommand_L(`docker build -t ${config['HUB_REPO']}:latest --target production --build-arg CI=true ${config['BUILD_ARGS']}.`, "docker build production");
        await proxy.executeCommand_L(`docker build -t ${config['HUB_REPO']}:dev --target dev --build-arg CI=true ${config['BUILD_ARGS']}.`, "docker build dev");
    } else {
        await proxy.executeCommand_L(`docker build -t ${config['HUB_REPO']}:dev -t ${config['HUB_REPO']}:latest --build-arg CI=true ${config['BUILD_ARGS']}.`, "docker build");
    }
    log.info('... finished');
}

module.exports = {
    buildImage: buildImage,
    buildBaseImage: buildBaseImage
};

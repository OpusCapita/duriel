'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const fs = require('fs');

const getEnvVariables = require('./actions/getEnvVariables');
const buildDockerImage = require('./actions/docker/buildDockerImage');
const dockerHelper = require('./actions/helpers/dockerHelper');

async function run() {
    log.info("Starting to build base image.");
    if(!fs.existsSync('./Dockerfile.base')){
        log.info("No 'Dockerfile.base' was found - no base image will be build");
    }

    const config = getEnvVariables();
    await buildDockerImage.buildBaseImage(config);
    await dockerHelper.loginLocal(config);
    await dockerHelper.pushImage(config['HUB_REPO'], 'base');
    log.info("... finished build base image");
}

run();
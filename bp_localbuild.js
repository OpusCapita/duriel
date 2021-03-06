'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();

const getEnvVariables = require('./actions/getEnvVariables');
const buildDockerImage = require('./actions/docker/buildDockerImage');
const dockerCommandBuilder = require('./actions/docker/dockerCommandBuilder');
const dockerCompose = require('./actions/docker/runDockerCompose');
const monitorDockerContainer = require('./actions/docker/monitorDockerContainer_L');
const outputContainerLogs = require('./actions/outputContainerLogs');
const runUnitTests = require('./actions/runUnitTests');
const fileHandler = require('./actions/filehandling/fileHandler');
const gitHelper = require('./actions/helpers/gitHelper');
const dockerHelper = require('./actions/helpers/dockerHelper');
const versionHelper = require('./actions/helpers/versionHelper');
const buildDocs = require('./actions/buildDocs');

const exec = async () => {
    try {
        require('events').EventEmitter.prototype._maxListeners = 100;
        const config = await getEnvVariables();
        const compose_base = dockerCommandBuilder.dockerComposeBase();
        await dockerHelper.loginLocal(config);
        try{
            await dockerCompose(compose_base, "pull");
        } catch (e) {
            log.warn("docker pull did not exit successfull. is your service new? then everything is fine :)", e);
        }
        await buildDockerImage.buildImage(config);
        await dockerCompose(compose_base, "up -d");

        try {
            await monitorDockerContainer(config['CIRCLE_PROJECT_REPONAME'], 30, 5000);    // 30 attempts with 5 sec intervals
        } catch (error) {
            log.error("service not healthy!", error);
            await outputContainerLogs();
            process.exit(1);
        }
        await runUnitTests(compose_base);
        await gitHelper.setCredentials(config['GIT_USER'], config['GIT_EMAIL']);
        await gitHelper.tag(config['VERSION'], true);

        if (config['TARGET_ENV']) {
            log.info(`deployment to env: ${config['TARGET_ENV']} is planned - storing in bp-config`);
            await dockerHelper.tagAndPushImage(config['HUB_REPO'], "latest", config['VERSION'], config['VERSION']);
        } else {
            log.info(`no target-environment associated with the branch '${config['CIRCLE_BRANCH']}' \n no deployment is going to happen. \n exiting.`);
        }
        log.info("saving config for later buildprocess-steps");
        fileHandler.saveObject2File(config, "bp-config.json", true);
    } catch (error) {
        log.error("error during local building: ", error);
        process.exit(1);
    }
};
exec();




















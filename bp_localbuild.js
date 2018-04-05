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

const exec = async () => {
    try {

        const config = getEnvVariables();
        const compose_base = dockerCommandBuilder.dockerComposeBase();
        await dockerCompose(compose_base, "pull");
        await buildDockerImage(config);
        await dockerCompose(compose_base, "up -d");

        try {
            await monitorDockerContainer(config['CIRCLE_PROJECT_REPONAME'], 20, 5000);    // 20 attempts with 5 sec intervals
        } catch (error) {
            log.error("service not healthy!", error);
            await outputContainerLogs();
            process.exit(1);
        }
        await runUnitTests(compose_base);
        await gitHelper.setCredentials(config['GIT_USER'], config['GIT_EMAIL']);
        await gitHelper.tag(config['VERSION'], true);

        log.info("saving config for later buildprocess-steps");
        fileHandler.saveObject2File(config, "bp-config.json", true);

        if (config['TARGET_ENV'] === 'none') {
            log.info(`no target-environment associated with the branch '${config['CIRCLE_BRANCH']}' \n no deployment is going to happen. \n exiting.`);
            process.exit(0);
        }
        await dockerHelper.tagAndPushImage(config['HUB_REPO'], "latest", config['VERSION'], config['VERSION']);
    } catch (error) {
        log.error("error during local building: ", error);
        process.exit(1);
    }
};
exec();




















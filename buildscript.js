'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');

// Preparing
const getEnvVariables = require('./actions/getEnvVariables');

// Building, Starting, Testing locally
const buildDockerImage = require('./actions/docker/buildDockerImage');
const dockerCommandBuilder = require('./actions/docker/dockerCommandBuilder');
const dockerCompose = require('./actions/docker/dockerCompose');
const monitorDockerContainer = require('./actions/docker/monitorDockerContainer_L');
const outputContainerLogs = require('./actions/outputContainerLogs');
const runUnitTests = require('./actions/runUnitTests');
const setGitCredentials = require('./actions/git/setGitCredentials');
const tagGitCommit = require('./actions/git/tagGitCommit');
const tagAndPushImage = require('./actions/docker/tagAndPushDockerImage');
const fileHandler = require('./actions/filehandling/fileHandler');

const exec = async () => {
    try {
        // Preparing
        const config = getEnvVariables();

        //Building, Starting, Testing locally
        const compose_base = dockerCommandBuilder.dockerComposeBase();
        await dockerCompose(compose_base, "pull");
        await buildDockerImage(config);
        await dockerCompose(compose_base, "up -d");

        try {
            await monitorDockerContainer(config['CIRCLE_PROJECT_REPONAME'], 20, 5000);    // 20 attempts with 5 sec intervals
        } catch (error) {
            log.error(JSON.stringify(error));
            await outputContainerLogs();    // TODO: testerino?
            process.exit(1);
        }
        await runUnitTests(compose_base);
        await setGitCredentials(config);
        await tagGitCommit(config['VERSION'], config['CIRCLE_SHA1']);

        log.info("saving config for later buildprocess-steps");
        fileHandler.saveObject2File(config, "bp-config.json", true);

        // Starting Deployment
        if (config['TARGET_ENV'] === 'none') {
            log.info(`no target-environment associated with the branch '${config['CIRCLE_BRANCH']}' \n no deployment is going to happen. \n exiting.`);
            process.exit(0);
        }
        await tagAndPushImage(config['HUB_REPO'], "latest", config['VERSION'], config['VERSION']);
    } catch (error) {
        log.error("error during local building: ", error);
        process.exit(1);
    }
};
exec();




















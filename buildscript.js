'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');

// Preparing
const getEnvVariables = require('./actions/getEnvVariables');
const calculateRepoPath = require('./actions/calculateRepoPath');
const calculateTargetEnv = require('./actions/calculateTargetEnv');
const calculateVersion = require('./actions/calculateVersion');

// Building, Starting, Testing locally
const buildDockerImage = require('./actions/buildDockerImage');
const getComposeCommand = require('./actions/getComposeCommand');
const dockerCompose = require('./actions/dockerCompose');
const monitorDockerContainer = require('./actions/monitorDockerContainer_L');
const outputContainerLogs = require('./actions/outputContainerLogs');
const runUnitTests = require('./actions/runUnitTests');
const setGitCredentials = require('./actions/setGitCredentials');
const tagGitCommit = require('./actions/tagGitCommit');
const pushDockerImage = require('./actions/pushDockerImage');

// Deploying
const saveObject2File = require('./actions/saveObject2File');

const execute = async () => {
    try {
        // Preparing
        const config = getEnvVariables();
        config['REPO_PATH'] = calculateRepoPath(config);
        config['TARGET_ENV'] = calculateTargetEnv(config);
        config['MYSQL_PWD'] = `SECRET_${config['TARGET_ENV']}_MYSQL`;
        config["VERSION"] = calculateVersion(config);

        //Building, Starting, Testing locally
        const compose_base = getComposeCommand();
        await dockerCompose(compose_base, "pull");
        await buildDockerImage(config);
        await dockerCompose(compose_base, "up -d");

        try {
            await monitorDockerContainer(config['CIRCLE_PROJECT_REPONAME'], 20, 5000);    // 20 attempts with 5 sec intervals
        } catch (error) {
            log.error(JSON.stringify(error));
            await outputContainerLogs();
            process.exit(1);
        }
        await runUnitTests(compose_base);
        await setGitCredentials(config);
        await tagGitCommit(config['VERSION'], config['CIRCLE_SHA1']);
        
        log.info("saving config for later buildprocess-steps");
        saveObject2File(config, "bp-config.json", true);

        // Starting Deployment
        if (config['TARGET_ENV'] === 'none') {
            log.info(`no target-environment associated with the branch '${config['CIRCLE_BRANCH']}' \n no deployment is going to happen. \n exiting.`);
            process.exit(0);
        }

        await pushDockerImage(config['HUB_REPO'], ["latest", config['VERSION']], ["latest"]);
    }catch (error){
        log.error(error);
        process.exit(1);
    }
};
execute();




















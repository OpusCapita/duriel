'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const EnvProxy = require('../EnvProxy');
// Preparing
const gatherEnvVariables = require('./actions/gatherEnvVariables');
const calculateRepoPath = require('./actions/calculateRepoPath');
const calculateTargetEnv = require('./actions/calculateTargetEnv');
const calculateVersion = require('./actions/calculateVersion');
// Building, Starting, Testing locally
const buildDockerImage = require('./actions/buildDockerImage');
const getComposeCommand = require('./actions/getComposeCommand');
const dockerLogin = require('./actions/dockerLogin');
const dockerComposePull = require('./actions/dockerComposePull');
const dockerComposeUp = require('./actions/dockerComposeUp');
const monitorDockerContainer = require('./actions/monitorDockerContainer');
const outputContainerLogs = require('./actions/outputContainerLogs');
const runUnitTests = require('./actions/runUnitTests');
const setGitCredentials = require('./actions/setGitCredentials');
const tagGitCommit = require('./actions/tagGitCommit');
// Deploying
const getPublicIpForTargetEnvAction = require('./actions/getPublicIpForTargetEnv');
const pushDockerImageAction = require('./actions/pushDockerImage');


const execute = async () => {
    // Preparing
    const config = gatherEnvVariables();
    config['REPO_PATH'] = calculateRepoPath(config);
    config['TARGET_ENV'] = calculateTargetEnv(config);
    config['MYSQL_PWD'] = `SECRET_${config['TARGET_ENV']}_MYSQL`;
    config["VERSION"] = calculateVersion(config);

    //Building, Starting, Testing locally
    await dockerLogin(config);
    await dockerComposePull(config);
    await buildDockerImage(config);
    const composeCommand = getComposeCommand();
    await dockerComposeUp(composeCommand);
    try {
        await monitorDockerContainer(config['CIRCLE_PROJECT_REPONAME'], 20, 5000);    // 20 attempts with 5 sec intervals
    } catch (error){
        await outputContainerLogs();
    }
    await runUnitTests(composeCommand);

    await setGitCredentials(config);
    await tagGitCommit(config['VERSION'], config['CIRCLE_SHA1']);

    // Starting Deployment
    if(config['TARGET_ENV'] === 'none'){
        log.info("not target-environment associated with the branch \n no deployment is going to happen. \n exiting.");
        process.exit(0);
    }

    const connectionData = getPublicIpForTargetEnvAction(config);
    await pushDockerImageAction(config);
};
execute();




















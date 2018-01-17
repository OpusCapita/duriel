'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();

const gatherEnvVariablesAction = require('./actions/gatherEnvVariables');
const calculateRepoPathAction = require('./actions/calculateRepoPath');
const calculateTargetEnvAction = require('./actions/calculateTargetEnv');
const calculateVersionAction = require('./actions/calculateVersion');
const buildDockerImageAction = require('./actions/buildDockerImage');
const getComposeCommandAction = require('./actions/getComposeCommand');
const dockerComposeUpAction = require('./actions/dockerComposeUp');
const monitorDockerContainerAction = require('./actions/monitorDockerContainer');
const outputContainerLogsAction = require('./actions/outputContainerLogs');
const runUnitTestsAction = require('./actions/runUnitTests');
const setGitCredentialsAction = require('./actions/setGitCredentials');
const tagGitCommitAction = require('./actions/tagGitCommit');


const execute = async () => {
    // Preparing
    const config = gatherEnvVariablesAction();
    config['REPO_PATH'] = calculateRepoPathAction(config);
    config['TARGET_ENV'] = calculateTargetEnvAction(config);
    config['MYSQL_PWD'] = `SECRET_${config['TARGET_ENV']}_MYSQL`;
    config["VERSION"] = calculateVersionAction(config);

    //Building, Starting, Testing locally

    await buildDockerImageAction(config);
    const composeCommand = getComposeCommandAction();
    await dockerComposeUpAction(composeCommand);
    try {
        await monitorDockerContainerAction(config['CIRCLE_PROJECT_REPONAME'], 20, 5000);    // 20 attempts with 5 sec intervals
    } catch (error){
        await outputContainerLogsAction();
    }
    await runUnitTestsAction(composeCommand);

    await setGitCredentialsAction(config);
    await tagGitCommitAction(config['VERSION'], config['CIRCLE_SHA1']);

    // Starting Deployment

    if(config['TARGET_ENV'] === 'none'){
        log.info("not target-environment associated with the branch \n no deployment is going to happen. \n exiting.")
        process.exit(0);
    } else {

    }


};
execute();




















'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();

const calculateVersionAction = require('./actions/calculateVersion');
const calculateRepoPathAction = require('./actions/calculateRepoPath');
const calculateTargetEnvAction = require('./actions/calculateTargetEnv');
const gatherEnvVariables = require('./actions/gatherEnvVariables');
const buildDockerImageAction = require('./actions/buildDockerImage');
const dockerComposeUpAction = require('./actions/dockerComposeUp');
const monitorDockerContainerAction = require('./actions/monitorDockerContainer');
const outputContainerLogsAction = require('./actions/outputContainerLogs');


const execute = async () => {
    const config = gatherEnvVariables();
    config['REPO_PATH'] = calculateRepoPathAction(config);
    config['TARGET_ENV'] = calculateTargetEnvAction(config);
    config['MYSQL_PWD'] = `SECRET_${config['TARGET_ENV']}_MYSQL`;
    config["VERSION"] = calculateVersionAction(config);
    await buildDockerImageAction(config);
    await dockerComposeUpAction();
    try {
        await monitorDockerContainerAction(config['CIRCLE_PROJECT_REPONAME'], 20, 5000);    // 120 attempts with 5 sec intervals
    } catch (error){
        await outputContainerLogsAction();
    }
};
execute();




















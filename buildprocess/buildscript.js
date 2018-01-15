'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();

const gatherEnvVariables = require('./actions/gatherEnvVariables');
const calculateRepoPathAction = require('./actions/calculateRepoPath');
const calculateTargetEnvAction = require('./actions/calculateTargetEnv');
const calculateVersionAction = require('./actions/calculateVersion');
const buildDockerImageAction = require('./actions/buildDockerImage');
const getComposeCommandAction = require('./actions/getComposeCommand');
const dockerComposeUpAction = require('./actions/dockerComposeUp');
const monitorDockerContainerAction = require('./actions/monitorDockerContainer');
const outputContainerLogsAction = require('./actions/outputContainerLogs');
const runUnitTestsAction = require('./actions/runUnitTests');


const execute = async () => {
    const config = gatherEnvVariables();
    config['REPO_PATH'] = calculateRepoPathAction(config);
    config['TARGET_ENV'] = calculateTargetEnvAction(config);
    config['MYSQL_PWD'] = `SECRET_${config['TARGET_ENV']}_MYSQL`;
    config["VERSION"] = calculateVersionAction(config);
    await buildDockerImageAction(config);

    const composeCommand = getComposeCommandAction();
    await dockerComposeUpAction(composeCommand);
    try {
        await monitorDockerContainerAction(config['CIRCLE_PROJECT_REPONAME'], 20, 5000);    // 20 attempts with 5 sec intervals
    } catch (error){
        await outputContainerLogsAction();
    }
    await runUnitTestsAction(composeCommand);
};
execute();




















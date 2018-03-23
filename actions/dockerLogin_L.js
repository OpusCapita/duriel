'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

module.exports = async function(config){
    log.info(`logging into docker with user ${config['DOCKER_USER']}`);
    const proxy = new EnvProxy();
    await proxy.executeCommand_L(`docker login -u ${config['DOCKER_USER']} -p ${config['DOCKER_PASS']}`)
};
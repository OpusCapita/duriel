'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');

module.exports = async function(config){
    log.info(`setting git-credentials: user: ${config['GIT_USER']}, email: ${config['GIT_EMAIL']}`);
    const proxy = new EnvProxy();
    await proxy.executeCommand_L(`git config --global user.name ${config['GIT_USER']}`);
    await proxy.executeCommand_L(`git config --global user.email ${config['GIT_EMAIL']}`);
};
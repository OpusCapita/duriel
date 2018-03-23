'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
/**
 * logs into dockerhub
 * if no proxy instance is give into the function:
 * creating and closing a single EnvProxy instance based on the config.
 * @param config - contains [DOCKER_USER, DOCKER_PASS] - optional: connection-info for envproxy
 * @param proxy - envProxy instance to execute command in ENV
 * @returns nothing
 */
module.exports = async function(config, proxy){
    log.info(`logging into docker with user ${config['DOCKER_USER']}`);
    let createdProxy = false;
    if(!proxy){
        log.warn(`no proxy param - trying to init a proxy`);
        proxy = await new EnvProxy().init(config);
        createdProxy = true;
    }
    await proxy.executeCommand_L(`docker login -u ${config['DOCKER_USER']} -p ${config['DOCKER_PASS']}`);
    if(createdProxy){
        proxy.close();
    }
};
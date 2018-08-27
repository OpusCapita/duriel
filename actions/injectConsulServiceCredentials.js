/**
 * Action that injects values from the task_template to consul
 * @module
 */
'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();

/**
 * Save the service-client credentials of a service into consul
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @returns {Promise<void>}
 */
module.exports = async function (config, proxy) {

    if(!config['MYSQL_PW']) {
        log.warn("MySQL functions disabled as no database-password in env-vars.")
        return
    }
    let injectServiceUser = false;
    try{
        await proxy.getKeyValue(`${config['serviceName']}/service-client/password`);
        log.info("service-client password exists.");
    } catch(error){
        log.warn("no service-client password could be found. --> injecting");
        injectServiceUser = true;
    }

    if(injectServiceUser){
        await proxy.addKeyValueToConsul(`${config['serviceName']}/service-client/password`, config['svcUserPassword']);
        await proxy.addKeyValueToConsul(`${config['serviceName']}/service-client/username`, config['svcUserName']);
        await proxy.addKeyValueToConsul(`${config['serviceName']}/service-client/client-secret`, `SECRET_${config['TARGET_ENV']}_OIDCCLIENT`);
        await proxy.addKeyValueToConsul(`${config['serviceName']}/service-client/client-key`, `oidcCLIENT`);
    }

};


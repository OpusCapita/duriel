'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();


module.exports = async function (config, proxy) {
    let injectServiceUser = false;
    try{
        await proxy.getConsulKeyValue(`${config['serviceName']}/service-client/password`);
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


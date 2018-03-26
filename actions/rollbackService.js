'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const request = require('superagent');
const monitorDockerContainer = require('./monitorDockerContainer_E');

module.exports = async function (config, proxy) {
    const serviceId = await getServiceId(config, proxy);
    try {
        if (!serviceId) {
            throw new Error(`could not fetch serviceId for ${config['serviceName']}`);
        }
        const rollBackCommand = `docker service update --rollback ${config['serviceName']}`;
        const commandResponse = await proxy.executeCommand_E(rollBackCommand);

        log.info(`Watching if rollback is successful: `, commandResponse);
        let rollbackSuccess = await monitorDockerContainer(config, proxy, false, serviceId);
        if (rollbackSuccess && rollbackSuccess === 'paused') {
            await proxy.executeCommand_E(`docker service update ${serviceId}`);
            rollbackSuccess = await monitorDockerContainer(config, proxy, false, serviceId);
        }
        if (!rollbackSuccess || rollbackSuccess !== "success") {
            throw new Error(`service not healthy after rollback`);
        }
        log.info(rollbackSuccess);
    } catch (error) {
        log.error("error during rollback", error);
        if (error.message.includes("does not have a previous spec")) {
            log.info(`service has not previous version. going to remove it`);
            await proxy.executeCommand_E(`docker service rm '${config['serviceName']}'`);
            await proxy.removeDockerSecret(`${config['serviceName']}-consul-key`);
            return;
        }
    }
};

const getServiceId = async function (config, proxy) {
    const services = await proxy.getServices_E()
        .filter(service => service.name === config['serviceName']);
    if (services && services[0]) {
        return services[0].id;
    }
};

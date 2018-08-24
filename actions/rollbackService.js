/**
 * Action to rollback a service-update
 * @module
 */
'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const monitorDockerContainer = require('./docker/monitorDockerContainer_E');

/**
 *
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @returns {Promise<void>}
 */
module.exports = async function (config, proxy) {
    if (config.get('skip_service_rollback')) {
        log.warn("rollback is disabled via flag.")
        return;
    }


    log.info("rolling back service!");
    const serviceId = await getServiceId(config, proxy);
    try {
        if (!serviceId) {
            throw new Error(`could not fetch serviceId for ${config['serviceName']}`);
        }
        const rollBackCommand = `docker service update --rollback ${config['serviceName']}`;
        log.info("executing rollback-command", rollBackCommand);
        const commandResponse = await proxy.executeCommand_E(rollBackCommand);
        log.debug(`Watching if rollback is successful: `, commandResponse);

        let rollbackSuccess = await monitorDockerContainer(config, proxy, config['isCreateMode']);
        log.info("rollbacksuccess: ", rollbackSuccess);
        if (rollbackSuccess && rollbackSuccess === 'paused') {
            await proxy.executeCommand_E(`docker service update ${serviceId}`);
            rollbackSuccess = await monitorDockerContainer(config, proxy, config['isCreateMode']);
            log.info("rollbacksuccess: ", rollbackSuccess);
        }
        if (!rollbackSuccess || rollbackSuccess !== "success") {
            throw new Error(`service not healthy after rollback`);
        } else {
            throw new Error(`deployment failed, but rollback was successful`);
        }
    } catch (error) {
        log.error("error during rollback", error);
        if (error.message.includes("does not have a previous spec")) {
            log.info(`service has not previous version. going to remove it`);
            await proxy.executeCommand_E(`docker service rm '${config['serviceName']}'`);
            await proxy.removeDockerSecret(`${config['serviceName']}-consul-key`);
            return;
        }
        throw error;
    }
};

const getServiceId = async function (config, proxy) {
    const services = await proxy.getServices_E()
        .then(services => services.filter(service => service.name === config['serviceName']));
    if (services && services[0]) {
        return services[0].id;
    }
};

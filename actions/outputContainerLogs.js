/**
 * Action to dump service-logs
 * @module
 */
'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

/**
 * Dump the last logs of a service
 * @param serviceName
 * @param lines
 * @returns {Promise<void>}
 */
module.exports = async function(serviceName = "_main", lines = 250) {
    const proxy = new EnvProxy();
    const containers = await proxy.getContainers_L().
        filter(service => service.name.includes(serviceName));
    for (const service of containers) {
        const logs = await proxy.executeCommand_L(`docker logs ${service.name} --tail ${lines}`);
        log.info(logs);
    }
};

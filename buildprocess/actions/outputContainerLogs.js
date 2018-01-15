'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');

module.exports = async function (serviceName = "_main", lines = 250) {
    const proxy = new EnvProxy();
    const containers = await proxy.getContainers_L();
    containers.filter(service => service.name.includes(serviceName))
        .forEach(async function (service) {
                let logs = await proxy.executeCommand_L(`docker logs ${service.name} --tail ${lines}`);
                log.info(logs);
            }
        );
};
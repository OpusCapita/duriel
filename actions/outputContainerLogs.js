'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

module.exports = async function (serviceName = "_main", lines = 250) {
    const proxy = new EnvProxy();
    const containers = await proxy.getContainers_L()
        .filter(service => service.name.includes(serviceName));
    for (let service of containers) {
        let logs = await proxy.executeCommand_L(`docker logs ${service.name} --tail ${lines}`);
        log.info(logs);
    }
};
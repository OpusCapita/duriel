'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const helper = require('./helpers/utilHelper');

module.exports = async function (config, proxy) {
    const attempts = 10, interval = 5000;
    log.info("run integration tests...");
    for (let attempt = 1; attempt <= attempts; attempt++) {
        log.info(`running test no. ${attempt} of ${attempts}...`);
        const consulApiResponse = await proxy.getConsulHealthCheck(config['serviceName']);
        const totalChecks = helper.flattenArray(consulApiResponse.map(entry => entry.Checks))
            .filter(entry => entry['ServiceName'] === config['serviceName'])
            .length;
        const passingChecks = helper.flattenArray(consulApiResponse.map(entry => entry.Checks))
            .filter(entry => entry['ServiceName'] === config['serviceName'])
            .filter(entry => entry['Status'] === 'passing')
            .length;
        if (passingChecks > 0 && passingChecks === totalChecks) {
            log.info(`all ${totalChecks} are passing! - service is healthy!`);
            return true;
        } else if (passingChecks > 0) {
            log.warn(`${passingChecks} of ${totalChecks} checks are passing - service is healthy`);
            return true;
        } else {
            log.info(`0 checks are passing - waiting for ${interval}ms.`);
            await helper.snooze(interval);
        }
    }
    log.error(`service not healthy after ${attempts}`);
    return false;
};



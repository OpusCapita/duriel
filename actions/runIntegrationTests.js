'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const helper = require('./helpers/utilHelper');
const request = require('superagent');

module.exports = async function (config, proxy) {
    const attempts = 30, interval = 5000;
    log.info("running integration tests...");
    for (let attempt = 1; attempt <= attempts; attempt++) {
        log.info(`${helper.padLeft(attempt, '0', 2)}/${attempts}...`);
        const consulApiResponse = await proxy.getConsulHealthCheck(config['serviceName']);
        const totalChecks = helper.flattenArray(consulApiResponse.map(entry => entry.Checks))
            .filter(entry => entry['ServiceName'] === config['serviceName'])
            .length;
        const passingChecks = helper.flattenArray(consulApiResponse.map(entry => entry.Checks))
            .filter(entry => entry['ServiceName'] === config['serviceName'])
            .filter(entry => entry['Status'] === 'passing')
            .length;
        if ((passingChecks > 0 && passingChecks === totalChecks) || totalChecks === 0) {
            log.info(`${passingChecks} of ${totalChecks} checks are passing! - service is healthy!`);
            return await checkAccessability(config);
        } else {
            log.info(`0 checks are passing - waiting for ${interval}ms.`);
            await helper.snooze(interval);
        }
    }
    log.error(`service not healthy after ${attempts}`);
    return false;
};

/**
 * calls {targetEnv}/bnp
 * @param config
 * @returns success: body of the response, failure: null
 */
async function checkAccessability(config) {
    const testUrl = `${config['public_scheme']}://${config['public_hostname']}:${config['public_port']}/bnp/`;
    log.debug("url for testing accessability:", testUrl);
    return await request.get(testUrl)
        .then(res => res.body)
        .catch(error => {
            if(error.status === 302){
                return "successfully found redirect hell";
            }
            log.error("error durring accessability test: ", error.message);
            return null;
        })
}
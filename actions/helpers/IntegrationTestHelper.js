/**
 * Action to execute integration-tests
 * @module
 */
'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const helper = require('./utilHelper');
const request = require('superagent');

module.exports = {
    runIntegrationTests,
    checkAccessability,
    getConsulData
};

/**
 * Run integration tests on a service.
 * aka. check if consul says the service is healthy + check general availability of the application
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @param attempts {number} @default 30 - attempts done before failure
 * @param interval {number} @default 5000 - interval between attempts in milliseconds
 * @returns {Promise<boolean>}
 */
async function runIntegrationTests(config, proxy, attempts = 30, interval = 5000) {
    log.info("running integration tests...");

    let consulData;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        log.info(`${helper.padLeft(attempt, '0', 2)}/${attempts}...`);

        consulData = await getConsulData(config, proxy);
        const logBase = `${consulData.checks.passing.length} of ${consulData.checks.total.length} checks are passing`;
        if (consulData && (consulData.checks.passing.length === consulData.checks.total.length || config['chris_little_secret'])) {
            log.info(`${logBase} - service is healthy!`);
            return await checkAccessability(config);
        } else {
            log.info(`${logBase} - waiting for ${interval}ms.`);
            log.debug("Currently failing nodes: ", consulData.nodes.failing.join(", "));
            await helper.snooze(interval);
        }
        log.severe("current consul-data: ", consulData);
    }
    log.error(`service not healthy after ${attempts}`);
    log.debug("last data from consul: ", consulData);
    return false;
}

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
            if (error.status === 302) {
                return "successfully found redirect hell";
            }
            log.error("error durring accessability test: ", error.message);
            return null;
        })
}

/**
 * function that returns healthcheck-information from a service.
 * data is filtered by status (failing, passing, total)
 * data is grouped by
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @returns {Promise<object>}
 * @example {
 *              nodes: {passing: ['a'], failing: ['b'], total: ['a', 'b']}
 *              checks: {passing: ['a'], failing: ['b'], total: ['a', 'b']}
 *              serviceName: 'ChristianoDelPocko'
 *          }
 */
async function getConsulData(config, proxy) {
    if (!config['serviceName']) {
        log.warn("config does not contain a 'serviceName'");
        return;
    }

    const consulApiResponse = await proxy.getConsulHealthCheck(config['serviceName'])
        .catch(e => log.error(`could not get consul data for service ${config['serviceName']}`, e));
    if (!consulApiResponse)
        return;

    const serviceChecks = helper.flattenArray(consulApiResponse.map(it => it.Checks))
        .filter(it => it['ServiceName'] === config['serviceName']);

    const passingChecks = serviceChecks.filter(it => it['Status'] === 'passing');
    const failingChecks = serviceChecks.filter(it => it['Status'] !== 'passing');

    return {
        nodes: {
            passing: helper.getUniqueArray(passingChecks.map(it => it.Node)),
            failing: helper.getUniqueArray(failingChecks.map(it => it.Node)),
            total: helper.getUniqueArray(serviceChecks.map(it => it.Node))
        },
        checks: {
            passing: passingChecks.map(it => it.CheckID),
            failing: failingChecks.map(it => it.CheckID),
            total: serviceChecks.map(it => it.CheckID)
        },
        serviceName: config['serviceName']
    };

}

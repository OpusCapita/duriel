'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const request = require('superagent');

module.exports = async function (config, proxy) {
    const tries = 10;
    const snoozeTime = 5000;
    log.info("run integration tests...");
    for (let i = 1; i <= tries; i++) {
        log.info(`running test no. ${i}...`);
        const consulApiResponse = await proxy.getConsulHealthCheck(config['serviceName']);
        const totalChecks = flattenRecursive(consulApiResponse.map(entry => entry.Checks))
            .length;
        const passingChecks = flattenRecursive(consulApiResponse.map(entry => entry.Checks))
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
            log.info(`0 checks are passing - waiting for ${snoozeTime}ms.`);
            await snooze(snoozeTime);
        }
    }
    log.error(`service not healthy after ${tries}`);
    return false;
};

/**
 * fake Thread.sleep in js (needs async-await)
 * @param ms
 * @returns {Promise<any>}
 */
const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

const flattenRecursive = function (array) {
    return array.reduce(function (flat, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flattenRecursive(toFlatten) : toFlatten);
    }, [])
};

const flattenArray = function (arrayOfArrays) {
    return [].concat.apply([], arrayOfArrays)
};

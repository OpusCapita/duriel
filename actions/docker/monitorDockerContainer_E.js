'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const helper = require("../helpers/utilHelper");

module.exports = async function (config, proxy, isCreateMode, attempts = 60) {
    const interval = 5000;
    await getReplicaCount(config, proxy)
        .then(replicaCount => {
            log.debug("replicaCount is: ", replicaCount);
            attempts = attempts * replicaCount;
        })
        .catch(e => {
            log.warn("could not fetch replicacount.", e);
            return 1;
        });

    let lastState = {};

    for (let i = 1; i <= attempts; i++) {
        const logBase = `${helper.padLeft(i, '0', 2)}/${attempts}`;
        let serviceHealth = {};
        if (isCreateMode) {
            serviceHealth = await checkCreateStatus(config, proxy)
        } else {
            serviceHealth = await checkUpdateStatus(config, proxy);
        }

        if (['success'].includes(serviceHealth.state)) {

            if (lastState.state === serviceHealth.state) {
                log.info(`${logBase} - service up and running'`);
                return 'success';
            } else {
                log.info(`${logBase} - state successful for the first time, checking once more...`)
            }

        } else if (['unknown', 'updating', 'starting'].includes(serviceHealth.state)) {

            log.info(`${logBase} - current state: ${serviceHealth.state}, waiting for ${interval / 1000} sec'`);

        } else if (['paused'].includes(serviceHealth.state)) {

            if (lastState.state === serviceHealth.state) {
                log.warn(`${logBase} - current state: ${serviceHealth.state}`);
                return 'paused';
            } else {
                log.info(`${logBase} - state unsuccessful for the first time, checking once more...`)
            }

        } else {

            if (lastState.state === serviceHealth.state) {
                log.error(`${logBase} - current state: ${serviceHealth.state}`);
                return 'failure';
            } else {
                log.info(`${logBase} - state unsuccessful for the first time, checking once more...`)
            }

        }
        lastState = serviceHealth;
        await helper.snooze(interval);
    }
    return 'failure';
};

const checkUpdateStatus = async function (config, proxy) {
    const check = {state: 'unknown'};
    const inspection = JSON.parse(await proxy.executeCommand_E(`docker inspect ${config['serviceName']}`));
    log.severe("docker inspect: ", inspection);
    let state;
    try {
        state = inspection[0]['UpdateStatus']['State'];
    } catch (error) {
        log.error("could not fetch update-status", error);
        return check;
    }
    if (state === 'updating') {
        check.state = 'updating';
    } else if (['rollback_completed', 'completed'].includes(state)) {
        check.state = 'success'
    } else if (check.state === 'paused') {
        check.state = 'paused';
    } else if (check.state) {
        log.warn("no valid state: ", inspection);
        check.state = 'failure';
    } else {
        log.warn("no state", state);
    }
    return check;
};

const checkCreateStatus = async function (config, proxy) {
    const check = {state: 'unknown'};
    const services = await proxy.getServices_E();
    const serviceInfo = services.filter(service => service.name === config['serviceName'])[0];
    log.severe("serviceInfo: ", serviceInfo);
    if (serviceInfo) {
        if (serviceInfo.instances_up < serviceInfo.instances_target) {
            check.state = 'starting'
        } else if (serviceInfo.instances_up === serviceInfo.instances_target) {
            check.state = 'success'
        } else {
            check.state = 'error';
        }
    } else {
        check.state = 'failure';
    }
    return check;
};

async function getReplicaCount(config, proxy) {
    return await proxy.getServices_E()
        .then(services => services.filter(service => service.name === config['serviceName'])[0])
        .then(serviceInfo => {
            const up = serviceInfo.instances_up;
            const target = serviceInfo.instances_target;
            if (up !== target)
                log.warn(`seems like we are updating an unhealty service... up: ${up} target: ${target}`);
            return up || 1
        })
}
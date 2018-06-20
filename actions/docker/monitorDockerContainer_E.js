'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const helper = require("../helpers/utilHelper");

module.exports = async function (config, proxy, isCreateMode, attempts = 60) {
    const interval = 5000;
    for (let i = 1; i <= attempts; i++) {
        const logBase = `${helper.padLeft(i, '0', 2)}/${attempts}`;
        let serviceHealth = {};
        if (isCreateMode) {
            serviceHealth = await checkCreateStatus(config, proxy)
        } else {
            serviceHealth = await checkUpdateStatus(config, proxy);
        }
        if (['success'].includes(serviceHealth.state)) {
            log.info(`${logBase} - service up and running'`);
            return 'success';
        } else if (['unknown', 'updating', 'starting'].includes(serviceHealth.state)) {
            log.info(`${logBase} - current state: ${serviceHealth.state}, waiting for ${interval /1000} sec'`);
            await helper.snooze(interval)
        } else if (['paused'].includes(serviceHealth.state)) {
            log.warn(`${logBase} - - current state: ${serviceHealth.state}`);
            return 'paused';
        } else {
            log.error(`${logBase} - current state: ${serviceHealth.state}`);
            return 'failure';
        }
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
        log.warn("no valid state: ", check);
        check.state = 'failure';
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

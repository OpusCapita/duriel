'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');

module.exports = async function (config, proxy, isCreateMode, attempts = 30) {
    let serviceId = undefined;
    if (!isCreateMode) {
        serviceId = getServiceID(config, proxy);
    }
    const interval = 5000;
    for (let i = 0; i <= attempts; i++) {
        log.info(`Checking service-health ${i}/${attempts}`);
        let serviceHealth;
        if (isCreateMode) {
            serviceHealth = await checkCreateStatus(config, proxy)
        } else {
            serviceHealth = await checkUpdateStatus(config, proxy, serviceId);
        }
        if (['success'].includes(serviceHealth.state)) {
            log.info("success! service up and running!");
            return 'success';
        } else if (['unknown', 'updating', 'starting'].includes(serviceHealth.state)) {
            log.info("waiting a bit and checking again!");
            await snooze(interval)
        } else if (['paused'].includes(serviceHealth.state)) {
            return 'paused';
        } else {
            log.error(`${serviceHealth.state}`);
            return 'failure';
        }
    }
    return 'failure';
};

const getServiceID = async function (config, proxy) {
    return await proxy.executeCommand_E(`docker service inspect ${config['CIRCLE_PROJECT_REPONAME']}`)
};

const checkCreateStatus = async function (config, proxy) {
    const check = {state: 'unknown'};
    const services = await proxy.getServices_E();
    const serviceInfo = services.filter(service => service.name === config['serviceName'])[0];
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

const checkUpdateStatus = async function (config, proxy, serviceId) {
    const check = {state: 'unknown'};
    const inspection = JSON.parse(await proxy.executeCommand_E(`docker inspect ${serviceId}`));
    const state = inspection[0]['UpdateStatus']['State'];
    if (state === 'updating') {
        check.state = 'updating';
    } else if (state === 'completed') {
        check.state = 'success'
    } else if (check.state) {
        check.state = 'failure';
    } else if (check.state === 'paused') {
        check.state = 'paused';
    }
    return check;
};

/**
 * fake Thread.sleep in js (needs async-await)
 * @param ms
 * @returns {Promise<any>}
 */
const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

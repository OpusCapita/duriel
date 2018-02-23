'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');

module.exports = async function (config, proxy, isCreateMode, serviceInformation) {
    const interval = 5000;
    const serviceId = serviceInformation[0].ID;
    log.info(serviceId);
    for (let i = 0; i <= 4; i++) {  // TODO: increase count on shipping
        let serviceHealth;
        if (isCreateMode || true) {
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
        } else {
            log.error(`${serviceHealth.state}`);
            return 'failure';
        }
    }
    return 'failure';
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
    }
    return check;
};

/**
 * fake Thread.sleep in js (needs async-await)
 * @param ms
 * @returns {Promise<any>}
 */
const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const fs = require('fs');
const helper = require("../helpers/utilHelper");

module.exports = async function (config, proxy, isCreateMode, attempts = 60) {
    const interval = 5000;
    for (let i = 1; i <= attempts; i++) {
        let serviceHealth = {};
        if (isCreateMode) {
            serviceHealth = await checkCreateStatus(config, proxy)
        } else {
            serviceHealth = await checkUpdateStatus(config, proxy);
        }
        log.info(`Checking service-health ${i}/${attempts} - current state: '${serviceHealth.state}'`);
        if (['success'].includes(serviceHealth.state)) {
            log.info("success! service up and running!");
            return 'success';
        } else if (['unknown', 'updating', 'starting'].includes(serviceHealth.state)) {
            log.info(`current status is: '${serviceHealth.state}'. waiting a ${interval / 1000} sec and checking again!`);
            await helper.snooze(interval)
        } else if (['paused'].includes(serviceHealth.state)) {
            return 'paused';
        } else {
            log.error(`${serviceHealth.state}`);
            return 'failure';
        }
    }
    return 'failure';
};

const checkUpdateStatus = async function (config, proxy) {
    const check = {state: 'unknown'};
    const inspection = JSON.parse(await proxy.executeCommand_E(`docker inspect ${config['serviceName']}`));
    log.debug("docker inspect: ", inspection);
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

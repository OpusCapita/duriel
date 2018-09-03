'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const helper = require("../helpers/utilHelper");
const loadTaskTemplate = require("../filehandling/loadTaskTemplate");

const AsciiTable = require('ascii-table');

module.exports = async function (config, proxy, isCreateMode, attempts = 60) {
    const interval = 5000;
    const replicaCount = await getReplicaCount(config, proxy);
    log.info("replicaCount:", replicaCount);
    attempts = attempts * replicaCount;

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
            if (serviceHealth.deployedVersions) {
                const table = renderVersionTable(serviceHealth.deployedVersions);
                log.info("\n", table.toString());
            }

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
    const check = {state: 'failure'};

    const inspection = await proxy.getServiceInspect_E(config['serviceName']);
    await proxy.getDeployedVersions_E(config['serviceName'])
        .then(it => check.deployedVersions = it)
        .catch(e => log.warn("could not fetch deployed versions"));

    log.severe("docker inspect: ", inspection);
    let state;
    try {
        state = inspection[0]['UpdateStatus']['State'];
    } catch (error) {
        log.warn("could not fetch any update-status", error);
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


function renderVersionTable(versions) {
    return Object.keys(versions)
        .map(key => AsciiTable.factory({
            title: `Deployed Versions (total: ${Object.keys(versions).length})`,
            heading: ["version", "node", "current state"],
            rows: versions[key].map((it) => ([key, it.node, it.currentState]))
        }).toString())
        .join("\n")
}

async function getReplicaCount(config, proxy) {

    const taskTemplate = loadTaskTemplate(config, undefined, true);
    let replicaCountTaskTemplate;
    try {
        if (taskTemplate['replicas'])
            replicaCountTaskTemplate = parseInt(taskTemplate['replicas']);
        else
            log.warn("replicaCout not set in task_template");
    } catch (e) {
        log.warn("could not fetch replicaCount from task_template.json", e);
    }

    const replicasOnSystem = await proxy.getReplicaCount_E(config['serviceName'])
        .then(it => parseInt(it))
        .catch(e => log.warn("could not fetch replicaCount from ENV", e));

    return replicaCountTaskTemplate || replicasOnSystem || 1;
}

module.exports.renderVersionTable = renderVersionTable;
module.exports.checkCreateStatus = checkCreateStatus;
module.exports.checkUpdateStatus = checkUpdateStatus;
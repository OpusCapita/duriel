'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');


module.exports = async function (config, proxy) {
    log.info(`Starting to service-values into consul...`);
    log.debug("loading task_template...");
    const taskTemplate = JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'}));
    log.debug("...finished downloading");
    log.severe("loadTaskTemplate: ", taskTemplate);

    const injectionValues = gatherInjectionVariables(taskTemplate, config);
    if (!injectionValues) {
        log.info('not values set for injection');
        return;
    }
    for (let key in injectionValues) {
        try {
            if (!injectionValues[key]) {
                log.warn(`...will not insert empty value for '${key}'`);
            } else {
                log.debug(`... injecting '${key}' to consul`);
                await proxy.addKeyValueToConsul(key, injectionValues[key]);
                log.debug(`... done.`);
            }
        } catch (error) {
            log.error('error while injecting kv-pairs to consul!');
        }
    }
};


const gatherInjectionVariables = function (taskTemplate, config) {
    log.info("Gathering variable for consul injection...");
    const result = {};
    const targetSettings = taskTemplate[config['TARGET_ENV']];
    if (targetSettings) {
        log.debug(`...gathering environment specific settings for env ${config['TARGET_ENV']}...`);
        const targetInjectionSettings = targetSettings['oc-consul-injection'];
        if (targetInjectionSettings) {
            for (let key in targetInjectionSettings) {
                log.debug(`... adding setting '${key}'`);
                result[`${config['serviceName']}/${key}`] = targetInjectionSettings[key];
            }
        }
    }
    const defaultSettings = taskTemplate['default'];
    const defaultInjectionSettings = defaultSettings['oc-consul-injection'];
    if (defaultInjectionSettings) {
        log.debug(`... gathering default settings ...`);
        for (let key in defaultInjectionSettings) {
            if (!result[`${config['serviceName']}/${key}`]) {
                log.debug(`... adding '${key}'`);
                result[`${config['serviceName']}/${key}`] = defaultInjectionSettings[key];
            }
        }
    }
    log.debug('... finished gathering consul injection variables: ', Object.keys(result));
    return result;
};
/**
 * @module
 */
'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');

const loadTaskTemplate = require('./filehandling/loadTaskTemplate');

/**
 * Inject variables from the task_template.json and inject them into consul
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @returns {Promise<void>}
 */
module.exports = async function(config, proxy) {
    log.info(`Starting inject to service-values into consul...`);

    log.debug("loading task_template...");
    const taskTemplate = loadTaskTemplate(config);
    log.debug("...finished downloading");
    log.severe("loadTaskTemplate: ", taskTemplate);

    const injectionValues = taskTemplate['oc-consul-injection'];
    if (!injectionValues) {
        log.info('not values set for injection');
        return;
    }
    log.info(`Adding keys to consul: ${Object.keys(injectionValues)}`);
    for (const key in injectionValues) {
        try {
            if (!injectionValues[key]) {
                log.warn(`...will not insert empty value for '${key}'`);
            } else {
                await proxy.addKeyValueToConsul(`${config['serviceName']}/${key}`, `${injectionValues[key]}`);
                log.severe(`... done.`);
            }
        } catch (error) {
            log.warn('error while injecting kv-pairs to consul!', error);
        }
    }
};

'use strict';

const loadTaskTemplate = require('../filehandling/loadTaskTemplate');

const utilHelper = require('../helpers/utilHelper')

/**
 *
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @returns {Promise<void>}
 */
async function syncDockerSecrets(config, proxy) {
    const taskTemplate = loadTaskTemplate(config['TARGET_ENV']);

    const secrets = taskTemplate['oc-secret-injection'];
    const systemSecrets = proxy.getDockerSecrets();
    
    const secretsForRemoval = utilHelper.arrayMinus(systemSecrets, Object.keys(secrets));
    const secretsForCreation = utilHelper.arrayMinus(Object.keys(secrets), systemSecrets);
}

module.exports = {
    syncDockerSecrets
};
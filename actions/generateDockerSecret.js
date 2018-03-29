'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();

/**
 *
 * @param fullReplacement - flag thats enables removing the secret before the new value
 * @param config - {'serviceName' : '', 'serviceSecretName' : ''}
 * @param proxy - initialized EnvProxy
 * @returns {Promise<{secretId, serviceSecret}>}
 */
module.exports = async function (fullReplacement, config, proxy) {
    const serviceSecret = await proxy.executeCommand_L(`openssl rand -base64 32`);
    if (!fullReplacement) {
        log.info(`failOnExit is false --> will drop secret`);
        await proxy.removeDockerSecret(config['serviceName']);
    }
    const secretId = await proxy.insertDockerSecret(serviceSecret, config['serviceSecretName']);
    return {secretId: secretId, serviceSecret: serviceSecret};

};
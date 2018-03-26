'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();

module.exports = async function (failOnExit, config, proxy) {
    const serviceSecret = await proxy.executeCommand_L(`openssl rand -base64 32`);
    if (!failOnExit) {
        log.info(`failOnExit is false --> will drop secret`);
        await proxy.removeDockerSecret(config['serviceName']);
    }
    const secretId = await proxy.insertDockerSecret(serviceSecret, config['serviceSecretName']);
    return {secretId: secretId, serviceSecret: serviceSecret};

};
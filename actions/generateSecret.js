'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();

module.exports = async function (failOnExit, config, proxy) {
    const serviceSecret = await proxy.executeCommand_L(`openssl rand -base64 32`);
    if (!failOnExit) {
        log.info(`failOnExit is false --> will drop secret`);
        await proxy.executeCommand_E(`docker secret rm '${config['serviceName']}'`);
    }
    const createSecretCommand = `echo '${serviceSecret}' | docker secret create '${config['serviceSecretName']}' - `;
    const secretId = await proxy.executeCommand_E(createSecretCommand);
    log.info(secretId);
    return {secretId: secretId, serviceSecret: serviceSecret};

};
'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();

const EnvProxy = require('../../EnvProxy')

/**
 *
 * @param fullReplacement - flag thats enables removing the secret before the new value
 * @param config - {Object}
 * e.g.: {'serviceName' : '', 'serviceSecretName' : ''}
 * @param proxy - initialized EnvProxy
 * @returns {Promise<{secretId, serviceSecret}>}
 */
module.exports = async function (fullReplacement, config, proxy) {
    const serviceSecret = await proxy.executeCommand_L(`openssl rand -base64 32`);
    if (!fullReplacement) {
        log.info(`failOnExit is false --> will drop secret`);
        await proxy.removeDockerSecret(config['serviceSecretName']);
    }
    const secretId = await proxy.insertDockerSecret(serviceSecret, config['serviceSecretName']);
    return {secretId: secretId, serviceSecret: serviceSecret};

};


async function create(config, proxy, secretName, length = 32) {
    const secret = await generateSecret(32);
    return await proxy.insertDockerSecret()
}

async function replace(config, proxy, secretName) {

}

async function remove(config, proxy, secretName) {
    return await proxy.removeDockerSecret(secretName);
}

async function get(config, proxy, secretName) {
    return proxy.getDockerSecrets()
        .filter(it => it.name === secretName);
}

async function getAll(config, proxy) {
    return await proxy.getDockerSecrets()
}

async function generateSecret(length) {
    if(!length)
        throw new Error("secret length?")
    return await new EnvProxy().executeCommand_L(`openssl rand -base64 ${length}`)
}
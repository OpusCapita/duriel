'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();

const EnvProxy = require('../../EnvProxy');

async function create(proxy, secretName, length = 32, ...labels) {
    const serviceSecret = await generateSecret(32);
    const secretId = await proxy.insertDockerSecret(serviceSecret, secretName, ...labels);
    return {
        secretId,
        secretName,
        serviceSecret
    }
}

async function replace(proxy, secretName) {
    await remove(proxy, secretName);
    return await create(proxy, secretName);
}

async function remove(proxy, secretName) {
    return await proxy.removeDockerSecret(secretName);
}

async function get(proxy, secretName) {
    return await proxy.getDockerSecrets()
        .then(secrets => secrets.filter(it => it.name === secretName))
        .then(secrets => {
            if (secrets.length === 1) {
                return secrets[0]
            } else {
                throw new Error(`could not find specific secret with name ${secretName}.\n found (${secrets.length})`);
            }
        })
}

async function getAll(proxy) {
    return await proxy.getDockerSecrets()
}

async function generateSecret(length) {
    if (!length)
        throw new Error("secret length?");
    return await new EnvProxy().executeCommand_L(`openssl rand -base64 ${length}`)
}

module.exports.getAll = getAll;
module.exports.get = get;
module.exports.create = create;
module.exports.remove = remove;
module.exports.replace = replace;
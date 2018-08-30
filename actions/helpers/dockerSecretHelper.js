'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();

const EnvProxy = require('../../EnvProxy');

const utilHelper = require('./utilHelper');
const loadTaskTemplate = require('../filehandling/loadTaskTemplate');

async function create(proxy, secretName, length = 32, ...labels) {
    const serviceSecret = await generateSecret(32);
    const secretId = await proxy.insertDockerSecret(serviceSecret, secretName, ...labels);
    return {
        id: secretId.trim(),
        name: secretName.trim(),
        serviceSecret: serviceSecret.trim()
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


async function getSecretsForDockerCommands(config, proxy) {

    const blackList = [`${config['serviceName']}-consul-key`]; // Can't touch this!

    const taskTemplate = loadTaskTemplate(config);
    const taskTemplateSecrets = taskTemplate["oc-secret-injection"];

    const necessarySecrets = utilHelper.arrayMinus(Object.keys(taskTemplateSecrets), blackList);
    const deployedSecrets = await proxy.getDockerSecretsOfService(config['serviceName'])
        .then(secrets => secrets.map(it => it.name))
        .then(nameList => utilHelper.arrayMinus(nameList, blackList));

    return {
        remove: utilHelper.arrayMinus(deployedSecrets, necessarySecrets),
        create: utilHelper.arrayMinus(necessarySecrets, deployedSecrets)
            .map(it => ({name: it, value: taskTemplateSecrets[it]}))
    }
}


module.exports.getAll = getAll;
module.exports.get = get;
module.exports.create = create;
module.exports.remove = remove;
module.exports.replace = replace;
module.exports.getSecretsForDockerCommands = getSecretsForDockerCommands;
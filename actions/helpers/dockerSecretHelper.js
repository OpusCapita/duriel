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
    const taskTemplateSecrets = transformSecretEntries(taskTemplate["oc-secret-injection"]);

    const necessarySecrets = utilHelper.arrayMinus(Object.keys(taskTemplateSecrets), blackList);
    const deployedSecrets = await proxy.getDockerSecretsOfService(config['serviceName'])
        .catch(e => {
            log.warn(`could not fetch secrets for service '${config['serviceName']}'`);
            log.severe(`could not fetch secrets for service '${config['serviceName']}'`, e);
            return [];
        })
        .then(secrets => secrets.map(it => it.name))
        .then(nameList => utilHelper.arrayMinus(nameList, blackList));


    const secretsForAdding = utilHelper.arrayMinus(necessarySecrets, deployedSecrets);

    const secretsOnEnv = await proxy.getDockerSecrets()
        .then(secrets => secrets.map(it => it.name));

    return {
        remove: utilHelper.arrayMinus(deployedSecrets, necessarySecrets),
        add: secretsForAdding,
        create: utilHelper.arrayMinus(secretsForAdding, secretsOnEnv)
            .map(it => ({name: it, value: taskTemplateSecrets[it]}))
    }
}

function transformSecretEntries(entries) {
    if (entries && entries instanceof Object && !Array.isArray(entries)) {
        const result = {};
        for (const key in entries) {
            const value = entries[key];
            if (typeof value === "string") {
                result[key] = value;
            } else if (value instanceof Object) {
                if (value.encoding) {
                    result[key] = Buffer.from(value.value, value.encoding).toString();
                } else if (value.value) {
                    result[key] = value.value
                }
            }
        }
        return result;
    } else if (entries) {
        throw new Error("Only input of type 'Object' allowed ");
    }
}

function generateUpdateServiceSecretParam(secrets) {
    if (!secrets)
        throw new Error("no param is no good.");

    const addPart = secrets.add.map(entry => `--secret-add ${entry}`).join(" ");
    const removePart = secrets.remove.map(entry => `--secret-rm ${entry}`).join(" ");
    return `${addPart} ${removePart}`;
}

function generateCreateServiceSecretParam(secrets) {
    if (!secrets)
        throw new Error("no param is no good.");
    return secrets.add.map(entry => `--secret ${entry}`).join(" ");
}

module.exports = {
    getAll,
    get,
    create,
    remove,
    replace,
    getSecretsForDockerCommands,
    transformSecretEntries,
    generateUpdateServiceSecretParam,
    generateCreateServiceSecretParam
};
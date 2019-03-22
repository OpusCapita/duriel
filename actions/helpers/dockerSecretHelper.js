'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();

const EnvProxy = require('../../EnvProxy');

const utilHelper = require('./utilHelper');
const loadTaskTemplate = require('../filehandling/loadTaskTemplate');

async function create(proxy, secretName, value, ...labels) {
    log.info(`Creating secret '${secretName}' with the labels [${labels.join(", ")}]`);
    const secretId = await proxy.insertDockerSecret(value, secretName, ...labels);
    return {
        id: secretId.trim(),
        name: secretName.trim(),
        serviceSecret: value.trim()
    }
}

async function generate(proxy, secretName, length = 32, ...labels) {
    const serviceSecret = await generateSecret(32);
    const secretId = await proxy.insertDockerSecret(serviceSecret, secretName, ...labels);
    return {
        id: secretId.trim(),
        name: secretName.trim(),
        serviceSecret: serviceSecret.trim()
    }
}

async function replace(proxy, secretName) {
    await remove(proxy, secretName).
        catch(e => log.warn(`could not delete secret '${secretName}'`, e));
    return await generate(proxy, secretName);
}

async function remove(proxy, secretName) {
    return await proxy.removeDockerSecret(secretName);
}

async function get(proxy, secretName) {
    return await proxy.getDockerSecret(secretName);
}

async function getAll(proxy) {
    return await proxy.getDockerSecrets()
}

async function generateSecret(length) {
    if (!length)
        throw new Error("secret length?");
    return await new EnvProxy().executeCommand_L(`openssl rand -base64 ${length}`)
}

/**
 *
 * Loading the secret-data from the task_template and concluding the entry-data for docker-commands
 * (e.g. which secrets to add/remove/create)
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @returns {Promise<{remove: Array, add: Array, create: Array<{name: string, value: string}>}>}
 */
async function getSecretsForDockerCommands(config, proxy) {

    log.info("1 - Fetching docker secrets from task_template");
    const blackList = [`${config['serviceName']}-consul-key`, 'kong-ssl-key']; // Can't touch this!

    log.info("1.1 - Loading task_template-data");
    const taskTemplate = loadTaskTemplate(config);
    let taskTemplateSecrets = transformSecretEntries(taskTemplate["oc-secret-injection"]);
    if (taskTemplateSecrets)
        log.debug("1.1 - secrets from task_template: ", Object.keys(taskTemplateSecrets));
    else
        taskTemplateSecrets = {};

    const necessarySecrets = utilHelper.arrayMinus(Object.keys(taskTemplateSecrets), blackList);
    log.info("1.2 - Loading Secrets on Env for service.");
    const deployedSecrets = await proxy.getDockerSecretsOfService(config['serviceName'])
        .catch(e => {
            log.warn(`could not fetch secrets for service '${config['serviceName']}'`);
            log.severe(`could not fetch secrets for service '${config['serviceName']}'`, e);
            return [];
        })
        .then(secrets => secrets.map(it => it.name))
        .then(nameList => utilHelper.arrayMinus(nameList, blackList));
    log.debug("1.2 - secrets on env for service: ", deployedSecrets);
    log.info("1.3 - Loading Secrets on Env.");
    const existingSecrets = await proxy.getDockerSecrets()
        .catch(e => {
            log.warn(`could not fetch secrets`);
            log.severe(`could not fetch secrets`, e);
            return [];
        })
        .then(secrets => secrets.map(it => it.name))
        .then(nameList => utilHelper.arrayMinus(nameList, blackList));
    log.debug("1.3 - secrets on env: ", existingSecrets);

    log.info("2.0 - Fetching secrets for adding, removing and creating.");
    const secretsForAdding = utilHelper.arrayMinus(utilHelper.arrayMinus(necessarySecrets, deployedSecrets), existingSecrets);
    const secretsOnEnv = await proxy.getDockerSecrets()
        .then(secrets => secrets.map(it => it.name));

    const result = {
        remove: utilHelper.arrayMinus(deployedSecrets, necessarySecrets),
        add: secretsForAdding,
        create: utilHelper.arrayMinus(secretsForAdding, secretsOnEnv)
            .map(it => ({name: it, value: taskTemplateSecrets[it]}))
    };
    log.debug("2.1 - secret fetching result: ", {
        add: result.add,
        remove: result.remove,
        create: result.create.map(it => ({name: it.name, value: `${it.value.substring(0, 4)}`}))
    });

    log.info("2 - ...finished fetching docker secrets.");
    return result;
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

async function createDockerSecrets(config, proxy, ...labels) {
    if (!config['serviceSecrets'])
        throw new Error("You try to call createDockerSecrets without secrets?!...");
    if (!Array.isArray(config['serviceSecrets'].create))
        throw new Error("secrets do not contain a create-Array");
    for (const secret of config['serviceSecrets'].create) {
        await create(proxy, secret.name, secret.value, ...labels)
    }
}

function generateUpdateServiceSecretParam(secrets) {
    if (!secrets)
        throw new Error("no param is no good.");

    const addPart = secrets.add
        .filter(it => it)
        .map(entry => `--secret-add ${entry}`);
    const removePart = secrets.remove
        .filter(it => it)
        .map(entry => `--secret-rm ${entry}`);

    return addPart
        .concat(removePart)
        .join(" ");
}

function generateCreateServiceSecretParam(secrets) {
    if (!secrets)
        throw new Error("no param is no good.");
    return secrets.add.map(entry => `--secret ${entry}`).join(" ");
}

module.exports = {
    getAll,
    get,
    generate,
    create,
    remove,
    replace,
    getSecretsForDockerCommands,
    transformSecretEntries,
    generateUpdateServiceSecretParam,
    generateCreateServiceSecretParam,
    createDockerSecrets
};
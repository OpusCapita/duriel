/**
 * Module to handle library versions
 * @module
 */

'use strict';

const fileHelper = require('../filehandling/fileHandler');
const versionHelper = require('./versionHelper');

const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

const extend = require('extend');
/**
 * Key inside the task_template for the service-dependencies
 * @type {string}
 */
const serviceDependencyKey = "serviceDependencies";
const libraryDependencyKey = "libraryDependencies";

/**
 * Get a specific library version from the package.json
 * @param library {string} e.g. "sequelize"
 * @param packageJson {object} package.json content
 * @returns {string} e.g. "4.4.4"
 */
function getLibraryVersion(library, packageJson) {
    packageJson = packageJson || fileHelper.loadFile2Object('./package.json');
    const dependencies = packageJson.dependencies;
    const devDependencies = packageJson.devDependencies;

    if (dependencies && dependencies[library])
        return dependencies[library];
    if (devDependencies && devDependencies[library])
        return devDependencies[library]
}

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV']
 * @param taskTemplate {object} task_template.json content
 */
function fetchServiceVersionDependencies(config = {}, taskTemplate) {
    return fetchVersionDependencies(config, taskTemplate, serviceDependencyKey);
}

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV']
 * @param taskTemplate {object} task_template.json content
 */
function fetchLibraryVersionDependencies(config = {}, taskTemplate) {
    return fetchVersionDependencies(config, taskTemplate, libraryDependencyKey);
}

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV']
 * @param taskTemplate {object} task_template.json content
 * @param dependencyKey {string} key indicating what kind of dependencies are requested.
 */
function fetchVersionDependencies(config, taskTemplate, dependencyKey) {
    taskTemplate = taskTemplate ? taskTemplate : fileHelper.loadFile2Object('./task_template.json');
    const targetEnv = config['TARGET_ENV'];

    let result = {};

    if (taskTemplate.default && taskTemplate.default[dependencyKey])
        result = extend(true, {}, result, taskTemplate.default[dependencyKey]);

    if (taskTemplate[targetEnv] && taskTemplate[targetEnv][dependencyKey]) {
        result = extend(true, {}, result, taskTemplate[targetEnv][dependencyKey])
    }

    if (Object.keys(result).length === 0) {
        log.warn(`task_template has no ${dependencyKey} (?!)`)
    }

    return result;
}

/**
 *
 * @param proxy {EnvProxy} initialized Instance of an EnvProxy
 * @param services {Array<string>} ServiceNames
 * @returns {object}
 */
async function loadServiceVersionsFromEnv(proxy, services) {
    return await proxy.getServices_E()
        .then(servicesOnEnv => servicesOnEnv.filter(it => services.includes(it.name)))
        .then(filteredServices => {
            const result = {};
            filteredServices.forEach(it => result[it.name] = it.image_version);
            return result;
        })
}

/**
 *
 * @param expectedVersions
 * @param deployedVersions
 * @returns {{errors: Array, passing: Array}}
 */
function checkServiceDependencies(expectedVersions, deployedVersions) {
    const result = {errors: [], passing: []};

    for (const service in expectedVersions) {
        const expectedVersion = expectedVersions[service];
        const deployedVersion = deployedVersions[service];

        if (!deployedVersion) {
            log.warn(`Service ${service} is not deployed`);
            result.errors.push(new ServiceCheckEntry(service, expectedVersion, deployedVersion))
        } else {
            const compareResult = versionHelper.compareVersion(deployedVersion, expectedVersion);
            if (compareResult < 0) {
                log.warn(`Version of '${service}' is incompatible`);
                result.errors.push(new ServiceCheckEntry(service, expectedVersion, deployedVersion))
            } else {
                result.passing.push(new ServiceCheckEntry(service, expectedVersion, deployedVersion))
            }
        }
    }
    result.success = result.errors.length === 0;
    return result;
}

async function checkLibraryDependencies(config, proxy, serviceDependencies, packageJson) {
    const result = {errors: [], passing: []};
    for (const service in serviceDependencies) {
        const libraryDependencies = await loadLibraryDependenciesOfService(config, proxy, service)
            .catch(e => result.errors.push(new LibraryCheckEntry(undefined, undefined, undefined, service, e.message)));
        if (libraryDependencies)
            for (const library in libraryDependencies) {

                const expected = libraryDependencies[library];
                const installed = getLibraryVersion(library, packageJson);
                const entry = new LibraryCheckEntry(library, expected, installed, service);
                const compareResult = versionHelper.compareVersion(installed, expected);

                if (compareResult < 0) {
                    log.warn(`Version of '${library}' is incompatble`);
                    result.errors.push(entry);
                } else {
                    result.passing.push(entry);
                }
            }
    }
    return result
}

/**
 *
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @param serviceName {string}
 * @returns {Promise<object>}
 */
async function loadLibraryDependenciesOfService(config, proxy, serviceName) {

    const serviceTasks = await proxy.getTasksOfServices_E(serviceName, true);
    const serviceTask = serviceTasks[0];

    if (!serviceTask)
        throw new Error(`could not fetch a task for service with name '${serviceName}'`);

    const containers = await proxy.getContainersOfService_N(serviceTask.node, serviceName, true);
    const container = containers[0];

    if (!container)
        throw new Error(`could not get container-information for service '${serviceName}' on node '${serviceTask.node}'`);

    const command = `docker exec -t ${container.containerId} cat task_template.json`;
    const taskTemplate = await proxy.executeCommand_N(serviceTask.node, command);

    return fetchLibraryVersionDependencies(config, JSON.parse(taskTemplate));
}


module.exports = {
    getLibraryVersion,
    fetchServiceVersionDependencies,
    checkLibraryDependencies,
    loadServiceVersionsFromEnv,
    checkServiceDependencies
};

/**
 * Simple holder of check information
 * @class
 */
class ServiceCheckEntry {
    /**
     * Get a resultEntry
     * @param service
     * @param expected
     * @param deployed
     */
    constructor(service, expected, deployed) {
        this.service = service;
        this.expected = expected;
        this.deployed = deployed;
    }
}

class LibraryCheckEntry {
    constructor(library, expected, installed = '-', service, reason = '-') {
        this.library = library;
        this.expected = expected;
        this.installed = installed;
        this.service = service;
        this.reason = reason;
    }
}
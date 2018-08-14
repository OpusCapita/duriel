/**
 * Module to handle library versions
 * @module
 */

'use strict';

const fileHelper = require('../filehandling/fileHandler');
const versionHelper = require('./versionHelper');

const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

const {ServiceCheckEntry, LibraryCheckEntry} = require('../classes/VersionValidation');

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

/**
 * Checks library dependencies of a service.
 * Loads the task_template of services via EnvProxy.
 * Then checks all library dependencies from the task_templates
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @param serviceDependencies {object} aggregated entries from task_template.json
 * @param packageJson {object} content of package.json
 * @returns {Promise<{errors: Array, passing: Array}>}
 */
async function checkLibraryDependencies(config, proxy, serviceDependencies, packageJson) {
    log.info("Checking library-dependencies of services: ", serviceDependencies);
    const result = {errors: [], passing: []};
    for (const service in serviceDependencies) {

        log.info(`checking libs of service '${service}'`);
        const libraryDependencies = await loadLibraryDependenciesOfService(config, proxy, service)
            .catch(e => {
                result.errors.push(new LibraryCheckEntry(undefined, undefined, undefined, service, e.message));
                return undefined;
            });


        if (libraryDependencies && Object.keys(libraryDependencies).length)
            for (const library in libraryDependencies) {

                const expected = libraryDependencies[library];
                const installed = await getLibraryVersion(library, packageJson);
                const entry = new LibraryCheckEntry(library, expected, installed, service);
                const compareResult = await versionHelper.compareVersion(installed, expected);

                if (compareResult < 0) {
                    log.warn(`Version of '${library}' is incompatible`);
                    result.errors.push(entry);
                } else {
                    log.info(`Version of '${library }' is compatible`);
                    result.passing.push(entry);
                }
            }
        else
            log.info(`service '${service}' has no library dependencies`);
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

    return await fetchLibraryVersionDependencies(config, JSON.parse(taskTemplate));
}


module.exports = {
    getLibraryVersion,
    fetchServiceVersionDependencies,
    checkLibraryDependencies,
    loadServiceVersionsFromEnv,
    checkServiceDependencies,
    ServiceCheckEntry,
    LibraryCheckEntry
};
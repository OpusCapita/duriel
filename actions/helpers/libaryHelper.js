/**
 * Module to handle library versions
 * @module
 */

'use strict';

const fileHelper = require('../filehandling/fileHandler');
const versionHelper = require('./versionHelper');

const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

const {ServiceCheckEntry, LibraryCheckEntry, CheckEntryHolder} = require('../classes/VersionValidation');

const extend = require('extend');

const path = require("path");
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
    //.then(servicesOnEnv => servicesOnEnv.filter(it => services.includes(it.name)))
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
 * @returns {object} e.g. {failing: Array, passing: Array}
 */
function checkService2ServiceDependencies(expectedVersions, deployedVersions) {
    const result = new CheckEntryHolder("Service2ServiceDependencies");

    for (const service in expectedVersions) {
        const expectedVersion = expectedVersions[service];
        const deployedVersion = deployedVersions[service];

        if (!deployedVersion) {
            log.warn(`Service ${service} is not deployed`);
            result.addFailingEntry(new ServiceCheckEntry(service, expectedVersion, deployedVersion))
        } else {
            const compareResult = versionHelper.compareVersion(deployedVersion, expectedVersion);
            if (compareResult < 0) {
                log.warn(`Version of '${service}' is incompatible`);
                result.addFailingEntry(new ServiceCheckEntry(service, expectedVersion, deployedVersion))
            } else {
                result.addPassingEntry(new ServiceCheckEntry(service, expectedVersion, deployedVersion))
            }
        }
    }
    return result;
}

/**
 * extracts "andariel_dependencies.json" from the node_modules dir.
 * e.g. {"name": "service-client", "serviceDependencies": {"supplier": "0.0.0"}}
 * checks the service dependencies from those files.
 * @param config {BaseConfig}
 * @param proxy {EnvProxy}
 * @param deployedServices {object} - e.g. {"supplier": "1.1.1", "customer": "2.2.2"}
 * @returns {object}
 * @example {failing: Array<ServiceCheckEntry>, passing: Array<ServiceCheckEntry>}
 */
async function checkLibrary2ServiceDependencies(config, proxy, deployedServices) {
    const result = new CheckEntryHolder("Library2ServiceDependencies");

    if (require('fs').existsSync('package.json')) {
        log.info("installing npm packages to collect library2service dependencies...");
        const output = await proxy.executeCommand_L('npm install');
        log.severe(output);
        log.debug("...finished installing packages.")
    } else
        return result;

    const dependencyFiles = fileHelper.getFilesInDir('node_modules', /andariel_dependencies\.json$/);
    log.debug("found andariel_dependencies.json-files: ", dependencyFiles);

    for (const file of dependencyFiles) {
        const fileContent = fileHelper.loadFile2Object(file);

        for (const entry in fileContent.serviceDependencies) {  // entry is name of a lib
            const deployedVersion = deployedServices[entry];
            const expectedVersion = fileContent.serviceDependencies[entry];
            let compareResult = versionHelper.compareVersion(deployedVersion, expectedVersion);

            if (entry === 'consul') {
                const consulData = await proxy.lookupService('consul');
                log.debug("Consul entry for 'consul'", consulData);
                compareResult = 9001;   // IT IS OVER 9000!!!
            }

            if (compareResult < 0) {
                log.warn(`Version of '${entry}' is incompatible`);
                result.addFailingEntry(new ServiceCheckEntry(entry, expectedVersion, deployedVersion, fileContent.name))
            } else {
                result.addPassingEntry(new ServiceCheckEntry(entry, expectedVersion, deployedVersion, fileContent.name))
            }

        }
    }

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
 * @returns {Promise<{failing: Array, passing: Array}>}
 */
async function checkLibraryDependencies(config, proxy, serviceDependencies, packageJson) {
    log.info("Checking library-dependencies of services: ", serviceDependencies);
    const result = new CheckEntryHolder("Library2ServiceDependencies");
    for (const service in serviceDependencies) {

        log.info(`checking libs of service '${service}'`);
        const libraryDependencies = await loadLibraryDependenciesOfService(config, proxy, service)
            .catch(e => {
                result.addFailingEntry(new LibraryCheckEntry(undefined, undefined, undefined, service, e.message));
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
                    result.addFailingEntry(entry);
                } else {
                    log.info(`Version of '${library }' is compatible`);
                    result.addPassingEntry(entry);
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
    checkService2ServiceDependencies,
    checkLibrary2ServiceDependencies,
    ServiceCheckEntry,
    LibraryCheckEntry,
    CheckEntryHolder
};
/**
 * Module to handle library versions
 * @module
 */

'use strict';

const fileHelper = require('../filehandling/fileHandler');
const loadTaskTemplate = require('../filehandling/loadTaskTemplate');
const versionHelper = require('./versionHelper');

const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

const { ServiceCheckEntry, LibraryCheckEntry, CheckEntryHolder } = require('../classes/VersionValidation');

const extend = require('extend');
const semver = require('semver');

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

    if (dependencies && dependencies[library]) {return dependencies[library];}
    if (devDependencies && devDependencies[library]) {return devDependencies[library]}
}

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV']
 * @param taskTemplate {object} task_template.json content
 */
function fetchServiceVersionDependencies(config, taskTemplate) {
    const fromTaskTemplate = fetchVersionDependencies(config, taskTemplate, serviceDependencyKey);
    log.debug("Service-dependencies from task_template.json: ", fromTaskTemplate);
    return extend(true, {}, fromTaskTemplate) // adding auth as default
}

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV']
 * @param taskTemplate {object} task_template.json content
 */
function fetchLibraryVersionDependencies(config, taskTemplate) {
    return fetchVersionDependencies(config, taskTemplate, libraryDependencyKey);
}

/**
 * returns a list that contains all andariel_dependecies.json files
 * @param proxy {EnvProxy}
 * @returns {Promise<Array<object>>}
 */
async function fetchLibrary2ServiceDependencies(proxy) {
    if (require('fs').existsSync('package.json')) {
        log.info("installing npm packages to collect library2service dependencies...");
        const output = await proxy.executeCommand_L('npm install');
        log.severe(output);
        log.debug("...finished installing packages.");
        return fileHelper.getFilesInDir('node_modules', /andariel_dependencies\.json$/).
            map(file => fileHelper.loadFile2Object(file))
    }
    return []
}

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV']
 * @param taskTemplate {object} task_template.json content
 * @param dependencyKey {string} key indicating what kind of dependencies are requested.
 */
function fetchVersionDependencies(config, taskTemplate, dependencyKey) {
    taskTemplate = taskTemplate || loadTaskTemplate(config);

    let result = {};

    if (taskTemplate && taskTemplate[dependencyKey]) {result = extend(true, {}, result, taskTemplate[dependencyKey]);}

    if (Object.keys(result).length === 0) {
        log.warn(`task_template has no ${dependencyKey} (?!)`)
    }

    return result;
}

/**
 *
 * @param proxy {EnvProxy} initialized Instance of an EnvProxy
 * @returns {object}
 */
async function loadServiceVersionsFromEnv(proxy) {
    return await proxy.getServices_E().
        then(services => {
            const result = {};
            services.forEach(it => result[it.name] = it.image_version);
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

    const dependencyEntries = fetchLibrary2ServiceDependencies(proxy);
    if (!dependencyEntries) {return;}

    log.info("found andariel_dependencies.json-files: ", dependencyEntries);

    for (const dependencies in dependencyEntries) {
        for (const entry in dependencies.serviceDependencies) { // entry is name of a lib
            const deployedVersion = deployedServices[entry];
            const expectedVersion = dependencies.serviceDependencies[entry];
            let compareResult = versionHelper.compareVersion(deployedVersion, expectedVersion);

            if (entry === 'consul') {
                const consulData = await proxy.lookupService('consul');
                log.debug("Consul entry for 'consul'", consulData);
                compareResult = 9001; // IT IS OVER 9000!!!
            }

            if (compareResult < 0) {
                log.warn(`Version of '${entry}' is incompatible`);
                result.addFailingEntry(new ServiceCheckEntry(entry, expectedVersion, deployedVersion, dependencies.name))
            } else {
                result.addPassingEntry(new ServiceCheckEntry(entry, expectedVersion, deployedVersion, dependencies.name))
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

    if (!require('fs').existsSync('package.json')) {
        log.info("Service has no package.json - skipping library-dependency-check");
        return result;
    }

    for (const service in serviceDependencies) {
        log.info(`checking libs of service '${service}'`);
        const libraryDependencies = await loadLibraryDependenciesOfService(config, proxy, service).
            catch(e => {
                result.addFailingEntry(new LibraryCheckEntry(undefined, undefined, undefined, service, e.message));
                return undefined;
            });


        if (libraryDependencies && Object.keys(libraryDependencies).length) {
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
        } else {log.info(`service '${service}' has no library dependencies`);}
    }
    return result
}

async function checkSystem2LibraryDependencies(config, proxy) {
    log.info("1. Checking system dependencies");
    const result = new CheckEntryHolder("System2LibraryDependencies");
    if (!require('fs').existsSync("./package.json")) {
        return result;
    }

    log.info("1.1 - loading installed versions of service.");
    let installedVersions = {};
    try {
        log.debug("executing npm install");
        await proxy.executeCommand_L("npm install", "npm install");

        await proxy.executeCommand_L("npm ls --json --depth=0 --silent").
            catch(e => log.warn("Something did not go well...", e)).
            then(response => {
                const parsed = response && JSON.parse(response);
                const dependencies = parsed ? parsed.dependencies : { };
                for (const lib in dependencies) {
                    const version = dependencies[lib].version;
                    log.severe(`1.1 - adding lib '${lib}' with version '${version}'`);
                    installedVersions[lib] = version;
                }
            })
    } catch (e) {
        log.warn("error during version fetching", e);
        installedVersions = {}
    }
    log.info("1.1 - fetched installed lib-versions: ", installedVersions);

    log.info("1.2 - loading envLibsDependencies.json");
    const systemDependencies = require('../../envLibDependencies')[config['TARGET_ENV']];
    if (!systemDependencies) {
        log.warn(`could not find dependencies for env '${config['TARGET_ENV']}'`);
        return;
    }
    log.debug(`1.2 - fetched envLibDependencies of '${config['TARGET_ENV']}'`, systemDependencies);
    log.info("2 - Checking the dependencies...");

    for (const systemDependency in systemDependencies) {
        log.info(`2.1 - Checking version of '${systemDependency}'`);
        const versionOfService = installedVersions[systemDependency];
        const expected = systemDependencies[systemDependency];
        log.debug(`2.1 - Found versions [service: '${versionOfService}', expected: '${expected}']`);
        if (versionOfService) {
            let isValid = true;

            try {
                isValid = semver.satisfies(versionOfService, systemDependencies[systemDependency]);
            } catch (e) {
                log.warn("could not validate version", e);
                isValid = true;
            }

            if (isValid) {
                result.addPassingEntry(new LibraryCheckEntry(systemDependency, expected, versionOfService, config['TARGET_ENV']))
            } else {
                result.addFailingEntry(new LibraryCheckEntry(systemDependency, expected, versionOfService, config['TARGET_ENV'], "invalid version"))
            }
        } else {
            result.addPassingEntry(new LibraryCheckEntry(systemDependency, expected, versionOfService, config['TARGET_ENV'], "not used"))
        }
    }
    return result;
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

    if (!serviceTask) {throw new Error(`could not fetch a task for service with name '${serviceName}'`);}

    const containers = await proxy.getContainersOfService_N(serviceTask.node, serviceName, true);
    const container = containers[0];

    if (!container) {throw new Error(`could not get container-information for service '${serviceName}' on node '${serviceTask.node}'`);}

    const command = `docker exec -t ${container.containerId} cat task_template.json`;
    let taskTemplateContent = '{}';
    try {
        taskTemplateContent = await proxy.executeCommand_N(serviceTask.node, command);
    } catch (e) {
        log.warn('Error:')
        log.warn(e);
        taskTemplateContent = '{}';
    }
    const parsedTaskTemplate = JSON.parse(taskTemplateContent);

    if (parsedTaskTemplate) {
        return fetchLibraryVersionDependencies(config, loadTaskTemplate(config, parsedTaskTemplate, true))
    }
}


module.exports = {
    getLibraryVersion,
    fetchServiceVersionDependencies,
    fetchLibrary2ServiceDependencies,
    checkLibraryDependencies,
    loadServiceVersionsFromEnv,
    checkService2ServiceDependencies,
    checkLibrary2ServiceDependencies,
    checkSystem2LibraryDependencies,
    ServiceCheckEntry,
    LibraryCheckEntry,
    CheckEntryHolder
};

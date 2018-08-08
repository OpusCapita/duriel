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
const serviceDependencyKey = "serviceDependencies";

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
    return dependencies[library] || devDependencies[library]
}

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV']
 * @param taskTemplate {object} task_template.json content
 */
function fetchServiceVersionDependencies(config, taskTemplate) {
    taskTemplate = taskTemplate ? taskTemplate : fileHelper.loadFile2Object('./task_template.json');
    const targetEnv = config['TARGET_ENV'];

    if (taskTemplate[targetEnv] && taskTemplate[targetEnv][serviceDependencyKey]) {
        return extend(true, {}, taskTemplate.default[serviceDependencyKey], taskTemplate[targetEnv][serviceDependencyKey])
    }
    return taskTemplate.default[serviceDependencyKey];
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

function checkServiceDependencies(expectedVersions, deployedVersions) {
    const result = {errors: [], passing: []};

    for (const service in expectedVersions) {
        const expectedVersion = expectedVersions[service];
        const deployedVersion = deployedVersions[service];

        if (!deployedVersion) {
            log.warn(`Service ${service} is not deployed`);
            result.errors.push({service: service, expected: expectedVersion, deployed: deployedVersion})
        } else {
            const compareResult = versionHelper.compareVersion(deployedVersion, expectedVersion);
            if (compareResult < 0) {
                log.warn(`Version of '${service}' is incompatible`);
                result.errors.push({service: service, expected: expectedVersion, deployed: deployedVersion});
            } else{
                result.passing.push({service: service, expected: expectedVersion, deployed: deployedVersion})
            }
        }
    }
    result.success = result.errors.length === 0;
    return result;
}

module.exports = {
    getLibraryVersion,
    fetchServiceVersionDependencies,
    loadServiceVersionsFromEnv,
    checkServiceDependencies
};

/**
 * Module to validate Service- and Library-Version-Dependencies
 * @module
 */
'use strict';
const libraryHelper = require('./helpers/libaryHelper');

const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV', ]
 * @param proxy {EnvProxy}
 * @returns {Promise<void>}
 */
async function validateVersionDependencies(config, proxy){
    const serviceDependencies = await libraryHelper.fetchServiceVersionDependencies(config);
    const deployedServiceVersions = await libraryHelper.loadServiceVersionsFromEnv(proxy, Object.keys(serviceDependencies));

    log.debug("Expected: ", serviceDependencies);
    log.debug("OnEnv: ", deployedServiceVersions);

    const validationResult = {};
    validationResult.serviceVersionCheck = libraryHelper.checkServiceDependencies(serviceDependencies, deployedServiceVersions);

    return validationResult
}

module.exports = {
    validateVersionDependencies
};
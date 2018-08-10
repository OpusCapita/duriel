/**
 * Module to validate Service- and Library-Version-Dependencies
 * @module
 */
'use strict';
const libraryHelper = require('./helpers/libaryHelper');

const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const utilHelper = require('./helpers/utilHelper');
const nunjucks = require('nunjucks');

async function checkVersionDependencies(config, proxy) {

    const validationResult = await validateVersionDependencies(config, proxy);
    const output = renderVersionValidationResult(validationResult);

    if (validationResult.success) {
        log.info("version validation was successfull: ", output);
    } else {
        log.error("version validation failed!: ", output);
        throw new Error("version validation failed!");
    }

}

/**
 *
 * @param config {BaseConfig} used fields: ['TARGET_ENV', ]
 * @param proxy {EnvProxy}
 * @returns {Promise<object>}
 */
async function validateVersionDependencies(config, proxy) {
    const serviceDependencies = await libraryHelper.fetchServiceVersionDependencies(config);
    const deployedServiceVersions = await libraryHelper.loadServiceVersionsFromEnv(proxy, Object.keys(serviceDependencies));

    const validationResult = {};
    validationResult.serviceVersionCheck = libraryHelper.checkServiceDependencies(serviceDependencies, deployedServiceVersions);

    validationResult.success = concludeValidationResult(validationResult);
    return validationResult;
}

function renderVersionValidationResult(validationResult) {
    validationResult.getLength = utilHelper.getLongestStringInObject;
    validationResult.padLeft = utilHelper.padLeft;

    nunjucks.configure({autoescape: true});
    return nunjucks.renderString(template, validationResult);
}

function concludeValidationResult(validationResult) {
    return Object.keys(validationResult)
        .reduce((reduced, current) => (reduced && !validationResult[current].errors.length), true);
}

module.exports = {
    concludeValidationResult,
    checkVersionDependencies,
    validateVersionDependencies,
    renderVersionValidationResult
};

const template =
    "\nServiceVersionCheck - success: {{serviceVersionCheck.success}}\n" +
    "Errors:\n" +
    "{% set length = getLength(serviceVersionCheck) %}" +
    "|{{padLeft('Service', ' ', length)}}|{{padLeft( 'Expected', ' ', length)}}|{{padLeft('Deployed', ' ', length)}}|\n" +
    "{{ padLeft('', '-', length * 3 + 4)}} \n" +
    "{% for error in serviceVersionCheck.errors %}" +
    "|{{ padLeft(error.service, ' ', length)}}|{{ padLeft(error.expected, ' ', length)}}|{{ padLeft(error.deployed, ' ', length)}}|\n" +
    "{% endfor %} \n" +
    "Passing:\n" +
    "|{{padLeft('Service', ' ', length)}}|{{padLeft( 'Expected', ' ', length)}}|{{padLeft('Deployed', ' ', length)}}|\n" +
    "{{ padLeft('', '-', length * 3 + 4)}} \n" +
    "{% for it in serviceVersionCheck.passing %}" +
    "|{{ padLeft(it.service, ' ', length)}}|{{ padLeft(it.expected, ' ', length)}}|{{ padLeft(it.deployed, ' ', length)}}|\n" +
    "{% endfor %}";

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

const extend = require('extend');

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

    const result = {
        validations: []
    };

    const serviceValidation = libraryHelper.checkServiceDependencies(serviceDependencies, deployedServiceVersions);
    const serviceValidationResult = extend(true, {},
        {name: "ServiceValidation",},
        serviceValidation
    );
    result.validations.push(serviceValidationResult);

    const libraryValidation = libraryHelper.checkLibraryDependencies(config, proxy, serviceDependencies);
    const libraryValidationResult = extend(true, {},
        {name: "LibraryValidation",},
        libraryValidation
    );

    result.validations.push(libraryValidationResult);

    result.success = concludeValidationResult(result.validations);
    return result;
}

function renderVersionValidationResult(validations) {
    let result = "";
    nunjucks.configure({autoescape: true, trimBlocks: true});
    for (const validation of validations.validations) {
        const functions = {
            length: utilHelper.getLongestStringInObject(validation),
            padLeft: utilHelper.padLeft,
            padBoth: utilHelper.padBoth
        };

        result += nunjucks.render(`${__dirname}/templates/${validation.name}.njk`, extend(true, {}, validation, functions));
    }
    return result

}

function concludeValidationResult(validations) {

    return validations.reduce((reduced, current) => reduced && (!current.errors || !current.errors.length), true);
}

module.exports = {
    concludeValidationResult,
    checkVersionDependencies,
    validateVersionDependencies,
    renderVersionValidationResult
};

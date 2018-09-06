/**
 * Module to validate Service- and Library-Version-Dependencies
 * @module
 */
'use strict';
const libraryHelper = require('./helpers/libraryHelper');

const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const utilHelper = require('./helpers/utilHelper');
const nunjucks = require('nunjucks');

const AsciiTable = require('ascii-table');
const extend = require('extend');

async function checkVersionDependencies(config, proxy) {

    const validationResult = await validateVersionDependencies(config, proxy);
    const output = renderVersionValidationResult(validationResult);

    if (validationResult.success) {
        log.info("version validation was successfull: ", output);
    } else {
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

    const service2serviceValidation = await libraryHelper.checkService2ServiceDependencies(serviceDependencies, deployedServiceVersions);
    result.validations.push(service2serviceValidation);

    const library2serviceValidation = await libraryHelper.checkLibrary2ServiceDependencies(config, proxy, deployedServiceVersions);
    result.validations.push(library2serviceValidation);

    const service2libraryValidation = await libraryHelper.checkLibraryDependencies(config, proxy, serviceDependencies);
    result.validations.push(service2libraryValidation);

    const system2libraryValidation = await libraryHelper.checkSystem2LibraryDependencies(config, proxy);
    result.validations.push(system2libraryValidation);

    result.success = await concludeValidationResult(result.validations);
    return result;
}

function renderVersionValidationResult(validations) {
    let entries = [];

    for (const validation of validations.validations) {
        if (validation.passing.length) {
            const table = AsciiTable.factory({
                title: `${validation.name} Passing`,
                heading: validation.passing[0].getDataHeader(),
                rows: validation.passing.map(it => it.asDataRow())

            });
            table.setBorder(undefined, undefined, undefined, '|');
            entries.push(table.toString())
        }
        if (validation.failing.length) {
            const table = AsciiTable.factory({
                title: `${validation.name} Failing`,
                heading: validation.failing[0].getDataHeader(),
                rows: validation.failing.map(it => it.asDataRow())
            });
            table.setBorder(undefined, undefined, undefined, '|');
            entries.push(table.toString());
        }
    }
    const result = nunjucks.render(`${__dirname}/templates/ValidationSummary.njk`, {entries});
    //log.info("", result);
    return result;

}

/**
 * Reduces an Array of BaseCheckEntries to by concluding all success-function results
 * @param validations {Array<BaseCheckEntry>}
 * @returns {boolean}
 */
function concludeValidationResult(validations) {
    return validations.reduce(
        (reduced, current) => reduced && current && current.success && current.success(),
        true
    );
}

module.exports = {
    concludeValidationResult,
    checkVersionDependencies,
    validateVersionDependencies,
    renderVersionValidationResult
};

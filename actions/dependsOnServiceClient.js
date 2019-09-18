/**
 * Action that checks if a service has a dependency to service-client or web-init
 * @module
 */
'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const libraryHelper = require('./helpers/libraryHelper')


const serviceClientLibs = ['@opuscapita/service-client', '@opuscapita/web-init', '@opuscapita/web-init'];

/**
 * check for service-client of web-init dependency
 * @returns {boolean}
 */
module.exports = function () {

    log.info("Checking dependency ti service-client...");
    if (!fs.existsSync('./package.json')) {
        log.warn("could not find package.json");
        return false;
    }

    log.debug("Checking dependencies to service-client lib...");
    let dependsOnServiceClient = false;
    for (const lib of serviceClientLibs) {
        log.debug(`checking for '${lib}'`);
        const libDependency = libraryHelper.getLibraryVersion(lib);
        dependsOnServiceClient |= !!libDependency;
        if(libDependency)
            log.debug(`service is dependent to ${lib}:${libDependency}`);
    }

    log.info(`service is ${dependsOnServiceClient ? "" : "not"} dependent on service-client`);
    return dependsOnServiceClient;
};
/**
 * Action that checks if a service has a dependency to service-client or web-init
 * @module
 */
'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');

/**
 * check for service-client of web-init dependency
 * @returns {boolean}
 */
module.exports = function () {
    if (!fs.existsSync('./package.json')) {
        log.warn("could not find package.json");
        return false;
    }
    const packageJson = fs.readFileSync('./package.json', {encoding: 'utf8'});
    log.info("loaded package.json successfully.");
    const parsedPackageJson = JSON.parse(packageJson);

    let result = true;
    result &= 'ocbesbn-service-client' in parsedPackageJson.dependencies;
    result &= 'ocbesbn-web-init' in parsedPackageJson.dependencies;

    return result
};
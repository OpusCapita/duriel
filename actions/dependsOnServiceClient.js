'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');

module.exports = function () {
    if (!fs.existsSync('./package.json')) {
        throw new Error("could not find package.json");
    }
    const packageJson = fs.readFileSync('./package.json', {encoding: 'utf8'});
    log.info("loaded package.json successfully: \n" + JSON.stringify(packageJson, null, 2));
    const parsedPackageJson = JSON.parse(packageJson);

    let result = true;
    result &= 'ocbesbn-service-client' in parsedPackageJson.dependencies;
    result &= 'ocbesbn-web-init' in parsedPackageJson.dependencies;

    return result
};
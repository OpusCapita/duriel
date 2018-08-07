/**
 * Module to handle library versions
 * @module
 */

'use strict';

const fileHelper = require('../filehandling/fileHandler');
const versionHelper = require('./versionHelper');

const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

function getLibraryVersion(library, packageJson){
    packageJson = packageJson || fileHelper.loadFile2Object('./package.json');
    const dependencies = packageJson.dependencies;
    const devDependencies = packageJson.devDependencies;
    return dependencies[library] || devDependencies[library]
}



module.exports = {
    getLibraryVersion
}

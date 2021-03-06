/**
 * Action to load a JSON and create a BaseConfig-Object based on it's data
 * @module
 */
'use strict';
const fileHandler = require('./fileHandler');
const getEnvVariables = require('../getEnvVariables');

const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

module.exports = function (fileName) {
    const dataFromFile = fileHandler.loadFile2Object(fileName);
    return getEnvVariables.getBaseConfigObject(dataFromFile);
};
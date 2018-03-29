'use strict';
const fileHandler = require('./fileHandler');
const getEnvVariables = require('../getEnvVariables');

module.exports = function (fileName) {
    const dataFromFile = fileHandler.loadFile2Object(fileName);
    return getEnvVariables.getBaseConfigObject(dataFromFile);
};
'use strict';
const fileHandler = require('./fileHandler');
const getEnvVariables = require('../getEnvVariables');

module.exports = function (fileName) {
    try {
        const dataFromFile = fileHandler.loadFile2Object(fileName);
        return getEnvVariables.getBaseConfigObject(dataFromFile);
    } catch (e) {
        log.warn("could not load file", e);
        return;
    }
};
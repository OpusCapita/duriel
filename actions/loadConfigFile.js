'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const file2object = require('./loadFile2Object');
const getEnvVariables = require('./getEnvVariables');

module.exports = function (fileName) {
    const dataFromFile = file2object(fileName);
    return getEnvVariables.getBaseConfigObject(dataFromFile);
};
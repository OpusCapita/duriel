'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const file2object = require('./loadFile2Object');
const getEnvVariables = require('./getEnvVariables');

module.exports = function (fileName) {
    const config = getEnvVariables.getBaseConfigObject();
    const dataFromFile = file2object(fileName);
    for(let key in dataFromFile){
        config[key] = dataFromFile[key];
    }
    return config;
};
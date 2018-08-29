'use strict'
/**
 * Action to load a the task_template and get the env-dependent data
 * @module
 */
'use strict';
const fileHandler = require('./fileHandler');

const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

const extend = require('extend');

module.exports = function (environment, fileContent) {
    try {
        const dataFromFile = fileContent || fileHandler.loadFile2Object("./task_template.json");

        return extend(true, {}, dataFromFile.default, dataFromFile[environment])

    } catch (e) {
        log.warn("could not load file", e);
    }
};
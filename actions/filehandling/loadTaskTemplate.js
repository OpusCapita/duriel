'use strict'
/**
 * Action to load a the task_template and get the env-dependent data
 * @module
 */
'use strict';
const fileHandler = require('./fileHandler');
const variableInjector = require('./injectVariables');


const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

const extend = require('extend');
const defaultData = {
    "limit-cpu": "0",
    "reserve-cpu": "0"
};

module.exports = function(config, fileContent, raw) {
    const dataFromFile = fileContent || fileHandler.loadFile2Object("./task_template.json");
    const mergedTemplate = extend(true, {}, defaultData, dataFromFile.default, dataFromFile[config['TARGET_ENV']]);
    if (raw) {return mergedTemplate;} else {
        const injectionResult = variableInjector(JSON.stringify(mergedTemplate), config);
        return JSON.parse(injectionResult);
    }
};

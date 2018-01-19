'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');
const fs = require('fs');

module.exports = function(config){

    const injectionRegex = /\${.*\}/;

    if(!fs.existsSync('./task_template.json')){
        log.error("could not find task_template.json");
        throw new Error("could not find task_template.json");
    }
    const taskTemplate = require('./task_template.json');
    log.info("loaded task_template successfully: \n" + JSON.stringify(taskTemplate, null, 2));
};
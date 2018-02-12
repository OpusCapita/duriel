'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');

module.exports = {
    dockerCreate: this.buildDockerCreate,
    dockerUpdate: this.buildDockerUpdate
};

const buildDockerCreate = function (config) {
    const taskTemplate = JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'}));
    const fieldDefs = JSON.parse(fs.readFileSync('./field_defs.json'));
    const wantedParams = getWantedParams(taskTemplate);
    const commandBase = `docker service create -d --with-registry-auth --secret='${config['serviceSecretName']}'`;
    log.info(wantedParams);
    for (let param of wantedParams) {
        let value;
        if (taskTemplate[`${config['TARGET_ENV']}`]) {
            value = taskTemplate[`${config['TARGET_ENV'][param]}`];
        }
        if(!value){
            value = taskTemplate['default'][param];
        }
        console.log(value)
    }
        //TODO finish him!

};
const buildDockerUpdate = function (config) {
};


const getWantedParams = function (taskTemplate) {
    let result = Object.keys(taskTemplate['production']);
    result.concat(Object.keys(taskTemplate['default']));
    result.unique();
    return result;
};
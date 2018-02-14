'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');

const buildDockerCreate = function (config) {
    const taskTemplate = JSON.parse(JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'})));
    log.info(taskTemplate);
    const fieldDefs = JSON.parse(fs.readFileSync('./field_defs.json'));
    log.info(fieldDefs);
    const wantedParams = getWantedParams(taskTemplate);
    const commandBase = `docker service create -d --with-registry-auth --secret='${config['serviceSecretName']}'`;
    log.info(wantedParams);
    for (let param of wantedParams) {
        let value;
        if (taskTemplate[`${config['TARGET_ENV']}`]) {
            value = taskTemplate[`${config['TARGET_ENV'][param]}`];
        }
        if (!value) {
            value = taskTemplate['default'][param];
        }
        console.log(value)
    }
    //TODO finish him!

};

const buildDockerUpdate = function (config) {
    const taskTemplate = JSON.parse(JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'})));
    const fieldDefs = JSON.parse(fs.readFileSync('./field_defs.json'));
    const serviceConfig = JSON.parse(fs.readFileSync('./service_config.json'))[0];  // json is an array --> use first entry.
    const wantedParams = getWantedParams(taskTemplate);

    let serviceSecretPart = "";
    if (config['serviceSecretName']) {
        serviceSecretPart = ` --secret-add='${config['serviceSecretName']}'`
    }
    const base_cmd = `docker service update -d${serviceSecretPart} --with-registry-auth`;
    let addedFields = [];
    for (let param of wantedParams) {
        const fieldDefinition = fieldDefs[`${param}`];
        if (fieldDefinition) {
            const type = fieldDefinition['type'];
            const fieldPath = fieldDefinition['path'];
            const valueFromServiceConfig = drillDown(serviceConfig, fieldPath);
            const desiredValue = getDesiredValue(taskTemplate, param, config);
            const collectedData = {
                name: param,
                sc: valueFromServiceConfig,
                dv: desiredValue,
                fieldDef: fieldDefinition
            };
            // log.info(type + " " + param);
            switch (type) {
                case 'mart':
                    addedFields.push(updateMart(collectedData));
                    break;
                case 'mark':
                    break;
                case 'marh':
                    break;
                case 'mar':
                    break;
                case 'repl':
                    addedFields.push(getMultipleOptionsFromString(collectedData));
                    break;
                case 'frepl':
                    addedFields.push(getMultipleOptionsFromArray(collectedData));
                    break;
                case 'update':
                    log.info("ignoring update-type");
                    break;
                case 'create':
                    log.info("ignoring create-type");
                    break;
                default:
                    log.info(`'${param}' --> type '${type}' is not supported`);
            }
        }
    }
    log.info("added fields: ", addedFields);
};

const updateMart = function (param) {
    log.info(param);
    // wenn nicht mehr gebraucht aber vorhanden --> --NAME-rm ck
    // sonst --NAME-rm ck + --Name --NAME-add dvof

};

const getMultipleOptionsFromArray = function (param) {
    let result = "";
    for (let opt of param.dv) {
        result += `--${param.name} ${opt} `
    }
    return result;
};

const getMultipleOptionsFromString = function (param) {
    if (param.dv) {
        return `--${param.name} ${param.dv}`;
    } else {
        return;
    }
};

/**
 * Method that drills down the service-config
 * @param dataHolder
 * @param path
 * @returns {*}
 */
const drillDown = function (dataHolder, path) {
    const pathEntries = path.split('/');
    if (pathEntries.length === 1) {
        return dataHolder[path];
    }
    const currentLocation = pathEntries.splice(0, 1);
    if (!dataHolder[currentLocation]) {
        log.error("path not found");
        return null;
    } else {
        return drillDown(dataHolder[currentLocation], pathEntries.join('/'))
    }

};

const getDesiredValue = function (taskTemplate, param, config) {
    const env = config['TARGET_ENV'];
    if (taskTemplate[`${env}`]) {
        if (taskTemplate[`${env}`][`${param}`]) {
            return taskTemplate[`${env}`][`${param}`];
        }
    }
    if (taskTemplate[`default`][`${param}`]) {
        return taskTemplate[`default`][`${param}`];
    }
};

const getWantedParams = function (taskTemplate) {
    log.info("gathering wanted params...");
    let result = [];
    if (taskTemplate['production']) {
        log.info("... adding production keys ...");
        result = result.concat(Object.keys(taskTemplate['production']));
    }
    if (taskTemplate["default"]) {
        log.info("... adding default keys ...");
        result = result.concat(Object.keys(taskTemplate["default"]));
    }
    log.info("... finished gathering finished params", result);
    return result;
};


module.exports = {
    dockerCreate: buildDockerCreate,
    dockerUpdate: buildDockerUpdate
};

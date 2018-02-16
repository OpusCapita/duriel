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
                cv: valueFromServiceConfig,
                dv: desiredValue,
                fieldDef: fieldDefinition
            };
            log.info(`handling param '${param}'\n\n`);
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

    // create map to translate name from task_template to field_defs

    const a = param['fieldDef']['fieldMap'];
    const tt2fdMap = {};
    for (let key of Object.keys(a)) {
        tt2fdMap[key.toLowerCase()] = a[key];
    }
    log.info("mapping from task_template to fieldmap with: ", tt2fdMap);

    //if input is array --> take first entry

    if (Array.isArray(param.cv)) {
        param.cv = param.cv[0];
    }

    for (let desiredValue of param.dv) {
        let isCommaSeperatedList = false;
        if (param['fieldDef']['rmKeyType'] === 'srcKVCommaSeparated') {
            log.info('value in task_template is an comma seperated list');
            isCommaSeperatedList = true;
        }
        let pairs4command = [];
        let dv_entries = desiredValue;

        if (isCommaSeperatedList) {
            dv_entries = desiredValue.split(',');      // not comma seperated zum array umformen? denglish ftw...
        }

        const dv_value_map = {};
        for (let dv_entry of dv_entries) {
            const dv_entry_split = dv_entry.split('=');
            let dv_entry_key = dv_entry_split[0];
            if (tt2fdMap[dv_entry_key]) {
                dv_entry_key = tt2fdMap[dv_entry_key]
            } else {    // it starts with uppercase...
                dv_entry_key = dv_entry_key.charAt(0).toUpperCase() + dv_entry_key.slice(1)
            }
            dv_value_map[dv_entry_key] = dv_entry_split[1];
        }
        // collecting non required current values
        Object.keys(param.cv)
            .filter(it => !Object.keys(dv_value_map).includes(it))
            .forEach(it => pairs4command.push({name: it, value: null, mode: 'delete'}));

        for (let key in dv_value_map) {
            const current = `${param.cv[key]}`;
            const desired = `${dv_value_map[key]}`;
            log.info(`current: ${current}, desired: ${desired}`);
            if (current !== desired) {
                log.info(`param '${key}' need to be updated`);
                pairs4command.push({name: key, value: dv_value_map[key], mode: 'update'})
            } else if (!current) {
                log.info(`param '${key}' is new`);
                pairs4command.push({name: key, value: dv_value_map[key], mode: 'create'})
            } else {
                log.info(`param '${key}' has not changed its value`);
            }
        }

        log.info("going to create command params from: ", pairs4command);

        let result = "";
        for (let kv_pair of pairs4command) {
            if (kv_pair.mode === 'update' || kv_pair.mode === 'delete') {
                result += ` --${kv_pair.name}-rm ${kv_pair.value}`   // TODO: stimmt das?
            }
            if (kv_pair.mode === 'update' || kv_pair.mode === 'create') {
                result += ` --${kv_pair.name}-add ${kv_pair.value}`
            }
        }
    }
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

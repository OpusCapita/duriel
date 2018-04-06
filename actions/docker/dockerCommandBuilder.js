'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const fs = require('fs');

const buildDockerCreate = function (config) {
    log.info("Building docker create command");
    const taskTemplate = JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'}))
    const fieldDefs = JSON.parse(fs.readFileSync('./field_defs.json'));
    const wantedParams = getWantedParams(taskTemplate);

    const base_cmd = `docker service create -d --with-registry-auth --secret='${config['serviceSecretName']}'`;
    const addedFields = [];

    for (let param of wantedParams) {
        const fieldDefinition = fieldDefs[`${param}`];
        if (fieldDefinition) {
            const type = fieldDefinition['type'];
            const desiredValue = getDesiredValue(taskTemplate, param, config);
            const collectedData = {
                name: param,
                dv: desiredValue,
                fieldDefinition: fieldDefinition
            };
            switch (type) {
                case 'mart':
                    addedFields.push(getMultipleOptionsFromArray(collectedData));
                    break;
                case 'mark':
                    addedFields.push(getMultipleOptionsFromArray(collectedData));
                    break;
                case 'mar':
                    addedFields.push(getMultipleOptionsFromArray(collectedData));
                    break;
                case 'marh':
                    addedFields.push(getMultipleOptionsFromArray(collectedData));
                    break;
                case 'repl':
                    addedFields.push(getMultipleOptionsFromString(collectedData));
                    break;
                case 'frepl':
                    addedFields.push(getMultipleOptionsFromArray(collectedData));
                    break;
                case 'create':
                    addedFields.push(getMultipleOptionsFromString(collectedData));
                    break;
                default:
                    log.warn(`'${param}' --> type '${type}' is not supported`);
            }
        }
    }
    log.debug("added fields: ", addedFields);
    return `${base_cmd} ${addedFields.map(it => it.trim()).filter(it => it).join(' ')} ${config['HUB_REPO']}:${config['VERSION']}`;
};

const buildDockerUpdate = function (config, addSecret = false) {
    if (!fs.existsSync('./task_template_mapped.json')) {
        log.info("no task_template_mapped found. using simple update mode (only updating to new image");
        return `docker service update --force --image ${config['HUB_REPO']}:${config['VERSION']} ${config['CIRCLE_PROJECT_REPONAME']}`;
    }
    const taskTemplate = JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'}))
    const fieldDefs = JSON.parse(fs.readFileSync('./field_defs.json'));
    const serviceConfig = JSON.parse(fs.readFileSync('./service_config.json'))[0];  // json is an array --> use first entry.
    const wantedParams = getWantedParams(taskTemplate);

    let serviceSecretPart = " ";
    if (addSecret && config['serviceSecretName']) {
        serviceSecretPart = ` --secret-add '${config['serviceSecretName']}' `
    }
    const base_cmd = `docker service update -d${serviceSecretPart}--with-registry-auth`;
    let addedFields = [];
    for (let param of wantedParams) {
        const fieldDefinition = fieldDefs[`${param}`];
        if (fieldDefinition) {
            const type = fieldDefinition['type'];
            const fieldPath = fieldDefinition['path'];
            const valueFromServiceConfig = drillDown(serviceConfig, fieldPath); // current Value from service_config via DrillDown
            const desiredValue = getDesiredValue(taskTemplate, param, config);
            const collectedData = {
                name: param,
                cv: valueFromServiceConfig,
                dv: desiredValue,
                fieldDef: fieldDefinition
            };
            log.debug(`handling param '${param}'...`);
            switch (type) {
                case 'repl':
                    addedFields.push(getMultipleOptionsFromString(collectedData));
                    break;
                case 'frepl':
                    addedFields.push(getMultipleOptionsFromArray(collectedData));
                    break;
                case 'mart':
                    addedFields.push(updateMart(collectedData));
                    break;
                case 'mark':
                    addedFields.push(updateMark(collectedData));
                    break;
                case 'mar':
                    addedFields.push(updateMar(collectedData));
                    break;
                case 'marh':
                    addedFields.push(updateMarh(collectedData));
                    break;
                case 'update':
                    log.debug("ignoring update-type, skipping.");
                    break;
                case 'create':
                    log.debug("ignoring create-type, skipping.");
                    break;
                default:
                    log.debug(`'${param}' --> type '${type}' is not supported`);
            }
        }
    }
    log.info("added fields: ", addedFields);
    return `${base_cmd} ${addedFields.map(it => it.trim()).filter(it => it).join(' ')} --force --image ${config['HUB_REPO']}:${config['VERSION']} ${config['CIRCLE_PROJECT_REPONAME']}`;
};
/**
 * Adds up params for 'production' and 'default'
 * @param taskTemplate
 * @returns {Array<fields for docker-command>}
 */
const getWantedParams = function (taskTemplate) {
    log.info("gathering wanted params...");
    let result = [];
    if (taskTemplate['production']) {
        log.debug("... adding production keys ...");
        result = result.concat(Object.keys(taskTemplate['production']));
    }
    if (taskTemplate["default"]) {
        log.debug("... adding default keys ...");
        result = result.concat(Object.keys(taskTemplate["default"]));
    }
    log.info("... finished gathering finished params", result);
    return result;
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

/**
 * returns the value of a param from loadTaskTemplate
 * value = loadTaskTemplate[env] ?: loadTaskTemplate[default]
 * @param taskTemplate
 * @param param
 * @param config
 * @returns {*}
 */
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
/**
 *
 * @param result - string - changed by method
 * @param mappedKV - Object that holds name and value of the param
 * @param delimiter - delimiter between key and value
 * @param name - param-name (env, publish, host, etc. )
 * @returns result + mappedKV.map(toCommandParam)
 */
const addKeyValueParam = function (result, mappedKV, delimiter, name) {
    for (let key in mappedKV) {
        const entry = mappedKV[key];
        if (!entry.cv || entry.dv != entry.cv) {
            log.debug(`${key} is new or did change its value`);
            result += ` --${name}-add ${key}${delimiter}${entry.dv}`;
        } else {
            log.debug(`${key} did not change - skipping`);
        }
    }
    log.debug("addKeyValueParam: ", result);
    return result;
};

const updateMarh = function (param) {
    const delimiter = ':';
    let result = "";
    const mappedKV = {};
    param.dv.forEach(
        entry => {
            const split = entry.split(delimiter);
            const name = split[0];
            const value = split[1];
            mappedKV[name] = {dv: value};
        }
    );
    param.cv.forEach(
        entry => {
            const split = entry.split(' ');
            const key = split[1];
            const value = split[0];
            if (mappedKV[key]) {
                mappedKV[key].cv = value
            } else {
                result += ` --${param.name}-rm ${name}`;
            }
        }
    );
    return addKeyValueParam(result, mappedKV, delimiter, param.name);
};

const updateMar = function (param) {
    const delimiter = '==';
    let result = "";
    const mappedKV = {};
    param.dv.forEach(entry => {
            const name = entry.split(delimiter)[0];
            const value = entry.split(delimiter)[1];
            mappedKV[name] = {dv: value};
        }
    );
    param.cv.forEach(
        entry => {
            const name = entry.split(delimiter)[0];
            const value = entry.split(delimiter)[1];
            if (mappedKV[name]) {
                mappedKV[name].cv = value;
            } else {
                log.debug(`${name} is not needed any more - removing`);
                result += ` --${param.name}-rm ${name}`;
            }
        });
    return addKeyValueParam(result, mappedKV, delimiter, param.name);
};

const updateMark = function (param) {
    const delimiter = '=';
    let result = "";
    const mappedKV = {};
    param.dv.forEach(entry => {
            const name = entry.split(delimiter)[0];
            const value = entry.split(delimiter)[1];
            mappedKV[name] = {dv: value};
        }
    );
    param.cv.forEach(
        entry => {
            const name = entry.split(delimiter)[0];
            const value = entry.split(delimiter)[1];
            if (mappedKV[name]) {
                mappedKV[name].cv = value;
            } else {
                log.info(`${name} is not needed any more - removing`);
                result += ` --${param.name}-rm ${name}`;
            }
        });
    return addKeyValueParam(result, mappedKV, delimiter, param.name);
};

const updateMart = function (param) {
    let result = "";
    const fieldMap = param['fieldDef']['fieldMap'];
    const isCommaSeperatedList = param['fieldDef']['rmKeyType'] === 'srcKVCommaSeparated';

    // create map to translate name from task_template to field_defs
    const tt2fdMap = {};
    const fd2ttMap = {};
    for (let key of Object.keys(fieldMap)) {
        const tt_value = key.toLowerCase();
        const fd_value = fieldMap[key];
        tt2fdMap[tt_value] = fd_value;
        fd2ttMap[fd_value] = tt_value;
    }
    log.debug(`creating task_template to field_definition mapping:\n'task_template 2 fieldMap' --> ${JSON.stringify(tt2fdMap)}\n'fieldMap 2 task_template' --> ${JSON.stringify(fd2ttMap)}`);


    if (Array.isArray(param.cv)) {
        param.cv = param.cv[0];
    }

    let pairs4remove = [];
    let pairs4insert = [];
    for (let desiredValue of param.dv) {
        let dv_entries = desiredValue;

        if (isCommaSeperatedList) {
            dv_entries = desiredValue.split(',');      // not comma seperated zum array umformen? denglish ftw...
        }

        const dv_value_map = {};
        for (let dv_entry of dv_entries) {
            const dv_entry_split = dv_entry.split('=');
            let dv_entry_key = dv_entry_split[0];
            dv_value_map[dv_entry_key] = dv_entry_split[1];
        }
        // // collecting non required current values
        Object.keys(param.cv)
            .filter(it => fd2ttMap[it] && !Object.keys(dv_value_map).includes(fd2ttMap[it]))    // is there a mapping?
            .forEach(it => pairs4remove.push({name: fd2ttMap[it], value: null}));

        for (let key in dv_value_map) {
            let current = param.cv[tt2fdMap[key]];
            if (!current) { // value could be unmapped (e.g. protocol <-> Protocol)
                log.severe("could not find value via tt2fd-mapping - trying to get value via lowerCaseComparison of keys");
                for (let cv_key of Object.keys(param.cv)) {
                    if (key.toLowerCase() === cv_key.toLowerCase()) {
                        log.severe("found value!");
                        current = param.cv[cv_key];
                        break;
                    }
                }
                if (!current) {
                    log.warn("could not find value via lowerCaseComparison!")
                }
                current = `${current}`;
            }

            const desired = `${dv_value_map[key]}`;
            log.debug(`${key} --> current: '${current}', desired: '${desired}'`);
            if (current != desired) {   // !== returns idiotic non-valid results '3016' !== '3016' --> true
                log.severe(`param '${key}' need to be updated`);
                // pairs4remove.push({name: key, value: dv_value_map[key]}); //add params are implicit updates
                pairs4insert.push({name: key, value: dv_value_map[key]});
            } else if (!current) {
                log.severe(`param '${key}' is new`);
                pairs4insert.push({name: key, value: dv_value_map[key]})
            } else {
                log.severe(`param '${key}' has not changed its value`);
            }
        }
    }
    log.debug("going to create command params from: ", pairs4insert);

    pairs4insert = pairs4insert.map(entry => `${entry.name}=${entry.value}`);
    pairs4remove = pairs4remove.map(entry => `${entry.name}=${entry.value}`);


    if (isCommaSeperatedList) {
        if (pairs4remove.length > 0) {
            result += ` --${param.name}-rm ${pairs4remove.join(',')}`;
        }
        if (pairs4insert.length > 0) {
            result += ` --${param.name}-add ${pairs4insert.join(',')}`;
        }
    } else {
        if (pairs4remove.length > 0) {
            result += pairs4remove.map(it => `--${param.name}-rm ${it}`).join(" ");
        }
        if (pairs4insert.length > 0) {
            result += pairs4insert.map(it => `--${param.name}-add ${it}`).join(" ");
        }
    }
    for (let entry of pairs4insert) {
        log.info(entry);
    }
    return result;
};

const getMultipleOptionsFromArray = function (collectedData) {
    log.severe(`getMultipleOptionsFromArray: `, collectedData);
    let result = "";
    for (let opt of collectedData.dv) {
        result += `--${collectedData.name} ${opt} `
    }
    return result;
};

const getMultipleOptionsFromString = function (collectedData) {
    log.severe(`getMultipleOptionsFromString: `, collectedData);
    if (collectedData.dv) {
        return `--${collectedData.name} ${collectedData.dv}`;
    } else {
        return "";
    }
};

const buildDockerCompose = function () {
    log.info("building compose command:...");
    let command = "docker-compose -f docker-compose.yml";
    if (fs.existsSync("./docker-compose.ci.yml")) {
        log.debug("docker-compose.ci.yml exists");
        command += " -f docker-compose.ci.yml";
    } else {
        log.debug("no docker-compose.ci.yml - using docker-compose.yml");
    }
    log.info(`... finished.compose-command is "${command}"`);
    return command;
};

module.exports = {
    dockerCreate: buildDockerCreate,
    dockerUpdate: buildDockerUpdate,
    dockerComposeBase: buildDockerCompose
};

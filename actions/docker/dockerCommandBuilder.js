/**
 * Module that offers functions to create docker-commands
 * @module
 */
'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const fs = require('fs');
const fieldDefs = require('../../fieldDefs');
const util = require("../helpers/utilHelper");

const byteMappingValidation = /[0-9]+[KMGT]/;
const integerExtractor = /[0-9]+/;
const byteSuffixExtractor = /[KMGT]/;
const byteSuffixMapping = {
    K: 1024,
    M: 1048576,
    G: 1073741824,
    T: 1099511627776
};

const cpuMappingValidation = /[+-]?([0-9]*[.])?[0-9]+/;
const nanoFactor = 1000000000;

const buildDockerCreate = function (config) {
    log.info("Building docker create command");
    const taskTemplate = JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'}))
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
                case 'publish':
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
    log.debug("added fields: ", addedFields.map(it => it.trim()).filter(it => it));
    return `${base_cmd} ${addedFields.map(it => it.trim()).filter(it => it).join(' ')} ${config['HUB_REPO']}:${config['VERSION']}`;
};

const buildDockerUpdate = function (config, addSecret = false) {
    if (!fs.existsSync('./task_template_mapped.json')) {
        log.info("no task_template_mapped found. using simple update mode (only updating to new image");
        return `docker service update --force --image ${config['HUB_REPO']}:${config['VERSION']} ${config['CIRCLE_PROJECT_REPONAME']}`;
    }
    const taskTemplate = JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'}));
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
            const currentValue = util.drillDown(serviceConfig, fieldPath); // current Value from service_config via DrillDown
            const desiredValue = getDesiredValue(taskTemplate, param, config);
            const collectedData = {
                name: param,
                cv: currentValue,
                dv: desiredValue,
                fieldDefinition: fieldDefinition
            };
            log.debug(`handling param '${param}'...`);
            switch (type) {
                case 'repl':
                    addedFields.push(updateRepl(collectedData));
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
    log.debug("added fields: ", addedFields.map(it => it.trim()).filter(it => it));
    return `${base_cmd} ${addedFields.map(it => it.trim()).filter(it => it).join(' ')} --force --image ${config['HUB_REPO']}:${config['VERSION']} ${config['CIRCLE_PROJECT_REPONAME']}`;
};
/**
 * Adds up params for 'production' and 'default'
 * @param taskTemplate
 * @returns Array<string> fields for docker-command
 */
const getWantedParams = function (taskTemplate) {
    log.debug("gathering wanted params...");
    let result = [];
    if (taskTemplate['production']) {
        log.debug("... adding production keys ...");
        result = result.concat(Object.keys(taskTemplate['production']));
    }
    if (taskTemplate["default"]) {
        log.debug("... adding default keys ...");
        result = result.concat(Object.keys(taskTemplate["default"]));
    }
    log.debug("... finished gathering finished params", result);
    return result;
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
                result += ` --${param.name}-rm "${entry}"`;
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
    const fieldMap = param['fieldDefinition']['fieldMap'];
    // create map to translate name from task_template to field_defs
    const isCommaSeperatedList = param['fieldDefinition']['rmKeyType'] === 'srcKVCommaSeparated';

    const tt2fdMap = {};
    const fd2ttMap = {};
    if(fieldMap) {
        for (let key of Object.keys(fieldMap)) {
            const tt_value = key.toLowerCase();
            const fd_value = fieldMap[key];
            tt2fdMap[tt_value] = fd_value;
            fd2ttMap[fd_value] = tt_value;
        }
    }

    log.info("translating currentValue");
    const translatedCV = param.cv.map(it => {
        const result = {};
        for (let key of Object.keys(it)) {
            log.debug("cv-entry: ", key);
            const translatedKey = fd2ttMap[key];
            if (translatedKey) {
                result[translatedKey] = `${it[key]}`;   // Forcing it to be a String.
            } else {
                log.warn("no mapping for field " + key);
                result[key.toLowerCase()] = `${it[key]}`;
            }
        }
        return result;
    });

    log.info("translating desiredValue");
    const translatedDV = [];
    for (let currentDV of param.dv) {
        log.debug("handlinv dv: ", currentDV);
        const entry = {};
        const splitByField = currentDV.split(',');
        for (let field of splitByField) {
            log.severe("field of dv: ", field);
            const splitByKV = field.split("=");
            entry[splitByKV[0].toLowerCase()] = splitByKV[1];
        }
        translatedDV.push(entry);
    }

    log.severe("translatedCV is: ", translatedCV);
    log.severe("translatedDV is: ", translatedDV);

    const pairsForAdding = util.arrayMinus(translatedDV, translatedCV);
    const pairsForRemoving = util.arrayMinus(translatedCV, translatedDV);

    log.severe("pairs4adding: ", pairsForAdding);
    log.severe("pairs4Removing: ", pairsForRemoving);
    log.severe("ignoring: ", util.arrayIntersect(translatedDV, translatedCV));

    let command = "";
    for(let dv of pairsForAdding){
        command += ` --${param.name}-add ${Object.keys(dv).sort().map(it => `${it}=${dv[it]}`).join(',')}`;
    }

    for(let cv of pairsForRemoving){
        command += ` --${param.name}-remove ${Object.keys(cv).sort().map(it => `${it}=${cv[it]}`).join(',')}`;
    }

    return command;
};

const getMultipleOptionsFromArray = function (collectedData) {
    log.severe(`getMultipleOptionsFromArray: `, collectedData);
    let result = "";
    for (let opt of collectedData.dv) {
        result += `--${collectedData.name} ${opt} `
    }
    return result;
};

const updateRepl = function (collectedData) {
    if (collectedData.fieldDefinition.mapping) {
        if (collectedData.fieldDefinition.mapping === "custom2bytes") {
            if (!new RegExp(byteMappingValidation).test(collectedData.dv)) {
                throw new Error(`Task_Template contains invalid field for byte-mapping: '${collectedData.dv}'`);
            }
            const integerPart = new RegExp(integerExtractor).exec(collectedData.dv)[0];
            const suffixPart = new RegExp(byteSuffixExtractor).exec(collectedData.dv)[0];
            const mappedValue = integerPart * byteSuffixMapping[suffixPart];
            if (collectedData.cv && collectedData.cv === mappedValue) {
                log.debug(`value for ${collectedData.name} did not change - skipping!`);
                collectedData.dv = null;
            }
        } else if (collectedData.fieldDefinition.mapping === "cpu2nano") {
            if (!new RegExp(cpuMappingValidation).test(collectedData.dv)) {
                throw new Error(`Task_Template contains invalid field for cpu-limit-mapping: '${collectedData.dv}'`);
            }
            const mappedValue = collectedData.dv * nanoFactor;
            if (collectedData.cv && collectedData.cv === mappedValue) {
                log.debug(`value for ${collectedData.name} did not change - skipping!`);
                collectedData.dv = null;
            }
        }
    }
    return getMultipleOptionsFromString(collectedData);
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

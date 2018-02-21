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
            log.info(`handling param '${param}'\n`);
            switch (type) { // TODO reenter stuff on release!
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
                    log.info("ignoring update-type, skipping.");
                    break;
                case 'create':
                    log.info("ignoring create-type, skipping.");
                    break;
                default:
                    log.info(`'${param}' --> type '${type}' is not supported`);
            }
        }
    }
    log.info("added fields: ", addedFields);
    return `${base_cmd} ${addedFields.filter(it => it).join('')} ${config['HUB_REPO']}:${config['VERSION']} ${config['CIRCLE_PROJECT_REPONAME']}`;
};

const updateFields = function (result, mappedKV, delimiter, name) {
    for (let key in mappedKV) {
        const entry = mappedKV[key];
        if (!entry.cv || entry.dv != entry.cv) {
            log.info(`${key} is new or did change its value`);
            result += ` --${name}-add ${key}${delimiter}${entry.dv}`;
        } else {
            log.info(`${key} did not change - skipping`);
        }
    }
    log.info(result);
    return result;
};

const updateMarh = function (param) {
    const delimiter = ':';
    log.info(param);
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
    return updateFields(result, mappedKV, delimiter, param.name);
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
                log.info(`${name} is not needed any more - removing`);
                result += ` --${param.name}-rm ${name}`;
            }
        });
    return updateFields(result, mappedKV, delimiter, param.name);
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
    return updateFields(result, mappedKV, delimiter, param.name);
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
    log.info(`creating task_template to field_definition mapping...`);
    log.info("task_template 2 fieldMap --> ", tt2fdMap);
    log.info("fieldMap 2 task_template --> ", fd2ttMap);
    log.info('...finished.');


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

        log.info(param);

        for (let key in dv_value_map) {
            let current = param.cv[tt2fdMap[key]];
            if (!current) { // value could be unmapped (e.g. protocol <-> Protocol)
                log.debug("could not find value via tt2fd-mapping - trying to get value via lowerCaseComparison of keys");
                for (let cv_key of Object.keys(param.cv)) {
                    if (key.toLowerCase() === cv_key.toLowerCase()) {
                        log.debug("found value!");
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
            log.info(`${key} --> current: '${current}', desired: '${desired}'`);
            if (current == desired) {   // !== return idiotic non-valid results '3016' !== '3016' --> true
                log.info(`param '${key}' need to be updated`);
                pairs4remove.push({name: key, value: dv_value_map[key]});
                pairs4insert.push({name: key, value: dv_value_map[key]});
            } else if (!current) {
                log.info(`param '${key}' is new`);
                pairs4insert.push({name: key, value: dv_value_map[key]})
            } else {
                log.info(`param '${key}' has not changed its value`);
            }
        }
    }
    log.info("going to create command params from: ", pairs4insert);
    log.info(pairs4insert);

    pairs4insert = pairs4insert.map(entry => `${entry.name}=${entry.value}`);
    pairs4remove = pairs4remove.map(entry => `${entry.name}=${entry.value}`);


    if (isCommaSeperatedList) {
        if (pairs4remove) {
            result += ` --${param.name}-rm ${pairs4remove.join(',')}`;
        }
        if (pairs4insert) {
            result += ` --${param.name}-add ${pairs4insert.join(',')}`
        }
    } else {
        //
    }
    for (let entry of pairs4insert) {
        log.info(entry);
    }
    return result;
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

'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const variableInjector = require('./injectVariables');
const fs = require('fs');

module.exports = async function (config) {
    if (!fs.existsSync('./task_template.json')) {
        throw new Error("could not find task_template.json");
    }
    const taskTemplate = fs.readFileSync('./task_template.json', {encoding: 'utf8'});
    log.info("loaded task_template successfully.");

    log.info("Injecting values into task_template.json");
    const injectorResult = variableInjector(JSON.stringify(taskTemplate), config);
    if (!injectorResult.success) {
        // throw new Error(`could not inject all variables into task_template. missing: ${injectorResult.missing}`) // TODO: READD me on shipping
    }

    log.debug("Parsing edited data back to JSON");
    JSON.parse(injectorResult.result);
    log.info("Writing mapped task_template.json");
    fs.writeFileSync("./task_template_mapped.json", injectorResult.result, {encoding: 'utf8'});
    return injectorResult.result;
};

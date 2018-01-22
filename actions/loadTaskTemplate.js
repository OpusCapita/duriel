'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const injector = require('./injectVariables');
const fs = require('fs');

module.exports = async function (config) {
    if (!fs.existsSync('./task_template.json')) {
        log.error("could not find task_template.json");
        throw new Error("could not find task_template.json");
    }
    const taskTemplate = require('./task_template.json');
    log.info("loaded task_template successfully: \n" + JSON.stringify(taskTemplate, null, 2));

    const injectorResult = injector(JSON.stringify(taskTemplate), config);
    if (!injectorResult.success) {
        throw new Error(`could not inject all variables into task_template. missing: ${injectorResult.missing}`)
    }

    log.debug("Parsing edited data back to JSON");
    const parsedJSON = JSON.parse(injectorResult.result);

    log.info("Writing mapped task_template.json");
    await writeToFile("./task_template_mapped.json", JSON.stringify(parsedJSON, null, 2));
    return injectorResult.result;
};

const writeToFile = function (fileName, data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(fileName, data, function (error) {
            if (error)
                return reject(error);
            else
                return resolve();

        })
    });
};

'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

/**
 *
 * Action to inject config-entries into the input string.
 * injection-points musst be marked with '${' variableName '}'
 *
 * e.g. input: "${insertMe}", config: {insertMe: '$upe12$ec123t'}
 *      result {success: true, missing: [], result: "$upe12$ec123t"}
 *
 * @param input
 * @param config
 * @returns {{success: boolean, missing: ["Names of missing config-entries"], result: "inputWithInjections"}}
 */
module.exports = function (input, config) {
    const regex = /(?:\${)(?:[^'"}]*)(?:})/; //find'${' + anything but '}"' + find '}'
    const regExp = new RegExp(regex, 'g');

    let i = 0;
    let missingConfigVars = [];
    let regexResult = regExp.exec(input);
    while (regexResult) {
        log.info("replacing ", regexResult);
        const variableName = regexResult[0].substring(2, regexResult[0].length - 1);
        const replacement = config[variableName] ? config[variableName] : (config.fromProcessEnv(variableName) ? `${config.fromProcessEnv(variableName)}` : '');
        if (!replacement) {
            log.error(`${i++}: config variable ${variableName} is missing`);
            missingConfigVars.push(variableName);
        }
        log.info("replacing with", replacement.trim());
        input = input.replace(regexResult, replacement.trim());
        regexResult = regExp.exec(input);
    }
    return {
        success: missingConfigVars.length === 0,
        missing: missingConfigVars,
        result: input
    };
};




















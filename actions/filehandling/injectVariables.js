/**
 * Action to inject variables into a string
 * @module
 */
'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');

/**
 *
 * Action to inject config-entries into the input string.
 * injection-points musst be marked with '${' variableName '}'
 *
 * e.g. input: "${insertMe}", config: {insertMe: '$upe12$ec123t'}
 *      result {success: true, missing: [], result: "$upe12$ec123t"}
 *
 * @param input - {string} string with injection marked fields ${:env}
 * @param config - {BaseConfig} holder of variables for the injection
 * @returns input with injections
 */
module.exports = function (input, config) {
    const regex = /\${([^'"}]+)}/; //find'${' + anything but '}"' + find '}'
    const targetEnv = config['TARGET_ENV'];
    const envMarker = ":env";

    let i = 0;
    let missingConfigVars = [];
    let regexResult = input.match(regex);
    while (regexResult) {

        const varName = regexResult[0].substring(2, regexResult[0].length - 1);
        let varOrigin = varName;

        if (varName.includes(envMarker)) {
            log.severe(`injecting environment '${targetEnv}' for envMarker '${envMarker}'`);
            varOrigin = varOrigin.replace(envMarker, targetEnv);
        }

        let replacement = config.get(varOrigin);

        if (!replacement) {
            log.error(`${i++}: config variable ${varName} is missing`);
            replacement = "missing";
            missingConfigVars.push(varName);
        }

        log.debug(`injecting ${(replacement + "").substr(0, 4)}[...] for ${regexResult}`);
        input = input.replace(regexResult[0], `${replacement}`.trim());
        regexResult = input.match(regex);
    }
    if (missingConfigVars.length > 0) {
        throw new Error(`injection failed: ${missingConfigVars.join(", ")}`);
    }
    return input;
};




















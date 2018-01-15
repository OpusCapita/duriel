'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

const REQUIRED_ENV_VARS = ["GIT_USER", "GIT_EMAIL", "GIT_TOKEN", "DOCKER_USER", "DOCKER_PASS"];
const ADDITIONAL_ENV_VARS = ['CIRCLE_PROJECT_REPONAME', 'andariel_branch', 'CIRCLE_BRANCH', 'CIRCLE_BUILD_NUM'];

/**
 * CIRCLE_PROJECT_REPONAME === serviceName
 *
 */

module.exports = function () {
    const config = {};
    if (process.argv.length < 3) {
        log.error(`too few parameters ${ process.argv}`);
        process.exit(1);
    } else {
        config["HUB_REPO"] = process.argv[2];  // params start at 2 because 0 = node, 1 = js-script
    }

    let env_var_complete = true;
    for (let env_var of REQUIRED_ENV_VARS) {
        if (!process.env[env_var]) {
            log.error(`env_var '${env_var}' not set but necessary for the buildprocess!`);
            env_var_complete = false;
        } else {
            config[`${env_var}`] = process.env[env_var];
            log.debug(`env_var ${env_var} set successfully.`);
        }
    }

    if (!env_var_complete) {
        log.error("env vars are missing! exiting!");
        throw new Error("env vars are missing! exiting!");
    }

    for (let env_var of ADDITIONAL_ENV_VARS) {
        if (process.env[env_var]) {
            config[`${env_var}`] = process.env[env_var];
            log.debug(`env_var ${env_var} set successfully.`);
        } else {
            log.debug(`skipping ${env_var} - no environment value set`);
        }
    }
    return config;
};
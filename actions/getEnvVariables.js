'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const calculateVersion = require("./calculateVersion");


const REQUIRED_ENV_VARS = ["GIT_USER", "GIT_EMAIL", "GIT_TOKEN", "DOCKER_USER", "DOCKER_PASS"];
const ADDITIONAL_ENV_VARS = ['CIRCLE_PROJECT_REPONAME', 'CIRCLE_BRANCH', 'CIRCLE_BUILD_NUM', 'CIRCLE_SHA1', 'CIRCLE_TOKEN']; // TODO: SHA1 & Token are identical
/**
 * initials function that gatheres and calculates all variables needed for the buildprocess
 * @returns {*}
 */
module.exports = function () {
    const config = getBaseConfigObject();
    if (process.argv.length < 3) {
        log.error(`too few parameters ${ process.argv}`);
        process.exit(1);
    } else {
        config["HUB_REPO"] = process.argv[2];  // params start at 2 because 0 = node, 1 = js-script
    }

    let all_required_vars_set = true;
    for (let env_var of REQUIRED_ENV_VARS) {
        if (!process.env[env_var]) {
            log.error(`env_var '${env_var}' not set but necessary for the buildprocess!`);
            all_required_vars_set = false;
        } else {
            config[`${env_var}`] = process.env[env_var];
            log.severe(`env_var ${env_var} set successfully.`);
        }
    }

    if (!all_required_vars_set) {
        log.error("env vars are missing! exiting!");
        throw new Error("env vars are missing! exiting!");
    }

    for (let env_var of ADDITIONAL_ENV_VARS) {
        if (process.env[env_var]) {
            config[`${env_var}`] = process.env[env_var];
            log.severe(`env_var ${env_var} set successfully.`);
        } else {
            log.debug(`skipping ${env_var} - no value set`);
        }
    }
    log.info(`calculating env-depending variables...`);
    config['andariel_branch'] = config['CIRCLE_BRANCH'] === "master" ? "master" : "develop";
    config['REPO_PATH'] = calculateRepoPath(config['andariel_branch'], config['CIRCLE_BRANCH']);
    config['TARGET_ENV'] = calculateTargetEnv(config['CIRCLE_BRANCH']);
    config['MYSQL_PW'] = getDatabasePassword(config);
    config['VERSION'] = calculateVersion(config);
    config['serviceName'] = config['CIRCLE_PROJECT_REPONAME'];
    log.debug("done.");

    return config;
};

function calculateTargetEnv(circle_branch){
    switch (circle_branch) {
        case 'master':
            return "stage";
        case 'develop':
            return "develop";
        case "nbp":  // TODO: remove me
            return "develop";
        case 'test':
            return "test";
        default:
            return "none";
    }
}

function calculateRepoPath(andariel_branch, circle_branch){
    let result = `OpusCapita/andariel/${andariel_branch}`;
    if(circle_branch === 'master'){
        result = "OpusCapita/andariel/master";
    }
    return result;
}

function getDatabasePassword (config) {
    const valueKey = `SECRET_${config['TARGET_ENV']}_MYSQL`;
    if (process.env[valueKey]) {
        config[`${valueKey}`] = process.env[valueKey];
        log.severe(`env_var ${valueKey} set successfully.`);
    } else {
        throw new Error(`Database password was not set for env '${config['TARGET_ENV']}' (env-var: ${valueKey})`);
    }
}


const getBaseConfigObject = function (result = {}) {
    return new BaseConfig(result);
};

class BaseConfig {
    constructor(params) {
        for (let param in params) {
            this[param] = params[param];
        }
        this.get = this.get.bind(this);
        this.fromProcessEnv = this.fromProcessEnv.bind(this);
    }

    get(name) {
        return this[name] ? this[name] : this.fromProcessEnv(name);
    }

    fromProcessEnv(name) {
        const result = process.env[name];
        if (result) {
            return result.trim();
        }
    }

}

module.exports.getBaseConfigObject = getBaseConfigObject;










'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const calculateVersion = require("./helpers/versionHelper");
const calculateEnv = require('./calculateEnv');


const REQUIRED_ENV_VARS = ["GIT_USER", "GIT_EMAIL", "GIT_TOKEN", "DOCKER_USER", "DOCKER_PASS"];
const ADDITIONAL_ENV_VARS = ['CIRCLE_PROJECT_REPONAME', 'CIRCLE_BRANCH', 'CIRCLE_BUILD_NUM', 'CIRCLE_SHA1', 'CIRCLE_TOKEN', 'andariel_branch', "e2e_skip", "force_second_deployment"]; // TODO: SHA1 & Token are identical
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
    if (!config['andariel_branch']) {
        config['andariel_branch'] = config['CIRCLE_BRANCH'] === "master" ? "master" : "develop";
    }
    config['REPO_PATH'] = calculateRepoPath(config['andariel_branch'], config['CIRCLE_BRANCH']);
    config['TARGET_ENV'] = calculateEnv.firstTargetEnv(config['CIRCLE_BRANCH']);
    config['MYSQL_PW'] = getDatabasePassword(config);
    config['VERSION'] = calculateVersion.getDevTag(config);
    config['serviceName'] = config['CIRCLE_PROJECT_REPONAME'];
    config['E2E_TEST_BRANCH'] = getE2EBranch(config['CIRCLE_BRANCH']);
    log.debug("done.");

    return config;
};

function calculateRepoPath(andariel_branch, circle_branch) {
    let result = `OpusCapita/andariel/${andariel_branch}`;
    if (circle_branch === 'master') {
        result = "OpusCapita/andariel/master";
    }
    return result;
}

function getDatabasePassword(config) {
    const valueKey = `SECRET_${config['TARGET_ENV']}_MYSQL`;
    if (process.env[valueKey]) {
        log.severe(`env_var ${valueKey} set successfully.`);
        return process.env[valueKey];
    } else {
        if(config['TARGET_ENV'] === 'none'){
            return "none";
        }
        throw new Error(`Database password was not set for env '${config['TARGET_ENV']}' (env-var: ${valueKey})`);
    }
}

module.exports.getDatabasePassword = getDatabasePassword;


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

function getE2EBranch(circleBranch) {
    return circleBranch === "master" ? "master" : "develop";
}

module.exports.getE2EBranch = getE2EBranch;






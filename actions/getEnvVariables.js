'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const calculateVersion = require("./helpers/versionHelper");
const calculateEnv = require('./calculateEnv');


const REQUIRED_ENV_VARS = ["GIT_USER", "GIT_EMAIL", "GIT_TOKEN", "DOCKER_USER", "DOCKER_PASS"];
const ADDITIONAL_ENV_VARS = ['CIRCLE_PROJECT_REPONAME', 'CIRCLE_BRANCH', 'CIRCLE_BUILD_NUM', 'CIRCLE_SHA1', 'CIRCLE_TOKEN', 'andariel_branch', "e2e_skip", 'admin_user']; // TODO: SHA1 & Token are identical
const BUILD_ENV_VARS = ['DOCKER_BUILD_ARGS'];
/**
 * initials function that gatheres and calculates all variables needed for the buildprocess
 * @returns {*}
 */
module.exports = async function () {
    const config = getBaseConfigObject();
    if (process.argv.length < 3) {
        log.error(`too few parameters ${ process.argv}`);
        process.exit(1);
    } else {
        config["HUB_REPO"] = process.argv[2];  // params start at 2 because 0 = node, 1 = js-script
        if (process.argv.length < 4) {
            config["MULTI_STAGE"] = false;
        } else {
            config["MULTI_STAGE"] = process.argv[3] === "true";
        }
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
    config['BUILD_ARGS'] = '';
    for (let env_var of BUILD_ENV_VARS) {
        if (process.env[env_var]) {
            const build_args = process.env[env_var].split(',');
            for (let build_var of build_args) {
                if (process.env[build_var]) {
                    config[`${build_var}`] = process.env[build_var];
                    config['BUILD_ARGS'] += '--build-arg '+build_var+'='+process.env[build_var]+' ';
                    log.severe(`build_var ${build_var} set successfully.`);
                } else {
                    log.debug(`skipping build_var ${build_var} - no value set`);
                }
            }
        } else {
            log.debug(`skipping ${env_var} - no value set`);
        }
    }

    log.info(`calculating env-depending variables...`);
    if (!config['andariel_branch']) {
        config['andariel_branch'] = config['CIRCLE_BRANCH'] === "master" ? "master" : "develop";
    }
    config['REPO_PATH'] = calculateRepoPath(config['andariel_branch'], config['CIRCLE_BRANCH']);
    config['TARGET_ENV'] = calculateEnv.getTargetEnv(config['CIRCLE_BRANCH']);


    config['MYSQL_PW'] = getDatabasePassword(config);
    config['MYSQL_USER'] = getDatabaseUser(config);
    config['MYSQL_PW_AUTH'] = getDatabasePassword(config,'_AUTH');
    config['MYSQL_USER_AUTH'] = getDatabaseUser(config,'_AUTH');
    config['MYSQL_SERVICE'] = getDatabaseService(config);
    config['MYSQL_SERVICE_AUTH'] = getDatabaseService(config,'_AUTH');
    config['serviceName'] = config['CIRCLE_PROJECT_REPONAME'];
    config['VERSION'] = await calculateVersion.calculateImageTag(config);
    config['serviceVersion'] = config['VERSION'].replace(/\./g,'-');
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

module.exports.calculateRepoPath = calculateRepoPath;

/**
 * Fetches the db-password for the targetEnv
 * @param config
 * @returns {string} password
 */
function getDatabasePassword(config, service = '') {
    if(!config['TARGET_ENV']){
        return "none";
    }
    //TODO: check if Service needs DB;
    const valueKey = `SECRET_${config['TARGET_ENV']}_MYSQL`+service;
    if (config.get(valueKey)) {
        log.severe(`env_var ${valueKey} set successfully.`);
        return config.get(valueKey);
    } else {
        log.warn(`'${valueKey}' not found in env-vars. this will disable database-functions of the deployment.`);
        //throw new Error(`Database password was not set for env '${config['TARGET_ENV']}' (env-var: ${valueKey})`);
    }
}

module.exports.getDatabasePassword = getDatabasePassword;

/**
 * Fetches the db-user for the targetEnv
 * @param config
 * @returns {string} user
 */
function getDatabaseUser(config, service = '') {
    if(!config['TARGET_ENV']){
        return "none";
    }
    //TODO: check if User needs DB;
    const valueKey = `SECRET_${config['TARGET_ENV']}_MYSQL_USER`+service;
    if (config.get(valueKey)) {
        log.severe(`env_var ${valueKey} set successfully.`);
        return config.get(valueKey);
    } else {
        return 'root';
        //log.warn(`'${valueKey}' not found in env-vars. this will disable database-functions of the deployment.`);
        //throw new Error(`Database password was not set for env '${config['TARGET_ENV']}' (env-var: ${valueKey})`);
    }
}

module.exports.getDatabaseUser = getDatabaseUser;

/**
 * Fetches the db-service for the targetEnv
 * @param config
 * @returns {string} service
 */
function getDatabaseService(config, service = '') {
    if(!config['TARGET_ENV']){
        return "none";
    }
    //TODO: check if Service needs DB;
    const valueKey = `SECRET_${config['TARGET_ENV']}_MYSQL_SERVICE`+service;
    if (config.get(valueKey)) {
        log.severe(`env_var ${valueKey} set successfully.`);
        return config.get(valueKey);
    } else {
        //log.warn(`'${valueKey}' not found in env-vars. this will disable database-functions of the deployment.`);
        //throw new Error(`Database password was not set for env '${config['TARGET_ENV']}' (env-var: ${valueKey})`);
    }
}

module.exports.getDatabaseService = getDatabaseService;


const getBaseConfigObject = function (result = {}) {
    return new BaseConfig(result);
};

/**
 * Simple class to hold variables in the build-process
 * @class
 */
class BaseConfig {
    constructor(params) {
        for (let param in params) {
            this[param] = params[param];
        }
        this.get = this.get.bind(this);
        this.fromProcessEnv = this.fromProcessEnv.bind(this);
    }

    /**
     * Method that returns a variable inside the object or the env
     * @param name
     * @returns {*}
     */
    get(name) {
        return this[name] ? this[name] : this.fromProcessEnv(name);
    }

    /**
     * Method that returns a variable-value from env
     * @param name
     * @returns {string}
     */
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






'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');

const loadTaskTemplate = require('./actions/loadTaskTemplate');
const downloadFile = require('./actions/downloadFile');


module.exports = async function (config) {
    if (!config) {
        log.error(`no config passed info deploy.js! config: ${config === null}`);
    }

    let paramsMissing = false;
    if (!config['GIT_TOKEN']) {
        paramsMissing = true;
        log.error("GIT_TOKEN missing!")
    }

    if (!config['CIRCLE_PROJECT_REPONAME']) {
        paramsMissing = true;
        log.error("CIRCLE_PROJECT_REPONAME missing!")
    }

    const mandatoryField = ['public_hostname', 'public_ip', 'admin_address', 'target_user', 'logstash_ip', 'public_scheme', 'public_port'];     // TODO: store this somewhere centrally
    if (!checkProperties(config, mandatoryField)) {
        paramsMissing = true;
        log.error("some connection data are missing!");
    }

    if (paramsMissing) {
        log.error("params are missing! exiting!");
        process.exit(1);
    }
    loadTaskTemplate();


    // TODO: wanted params

    const field_defs_url = `https://raw.githubusercontent.com/${config['REPO_PATH']}/build_docker_command.sh?token=${config['GIT_TOKEN']}`
    downloadFile(field_defs_url, './field_defs.json');

    const build_docker_url = `https://raw.githubusercontent.com/$repoPath/build_docker_command.sh?token=${config['GIT_TOKEN']}`;
    downloadFile(build_docker_url, './build_docker_command.sh');
    // TODO: replace build_docker_command.sh completely



};

/**
 * Checks if values of an object are null.
 * checked values can be limited by check_values
 * @param obj
 * @param check_values
 * @returns {boolean}
 */
function checkProperties(obj, check_values) {
    const checkAll = !check_values;
    for (let key in obj)
        if (checkAll || !checkAll && check_values.includes(key))
            if (obj[key] === null || obj[key] === null)
                return false;
    return true;
}
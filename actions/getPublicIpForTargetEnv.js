'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const downloadFile = require('./downloadFile');


module.exports = async function (config) {
    const proxy = new EnvProxy();
    const public_ip_file = "public_ip.sh";  // TODO: das komplett ersetzen durch eine JSON?
    const url_base = `https://raw.githubusercontent.com/${config['REPO_PATH']}/public_ip.sh`;
    const url_params = `?token=${config['GIT_TOKEN']}`;

    try {
        downloadFile(url_base + url_params, public_ip_file);
    } catch (error) {
        log.error(`could not load 'public_ip.sh' from ${url_base}`);
        throw error;
    }
    const connectionData = {};
    await proxy.changePermission_L(public_ip_file, "+x");
    await proxy.executeCommand_L(`${public_ip_file} ${config['TARGET_ENV']}`);  // TODO replace me??

    const dataKeys = ['public_hostname', 'public_ip', 'admin_address', 'target_user', 'logstash_ip', 'public_scheme', 'public_port'];

    for (const key of dataKeys) {
        if (process.env[key]) {
            log.info(`${key} is set`);
            connectionData[key] = process.env[key];
        } else {
            log.warn(`${key} is not set`);
        }
    }
    return connectionData;
};
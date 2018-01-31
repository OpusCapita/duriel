'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const fs = require('fs');
const request = require('superagent');
const loadFileFromPrivateGit = require('./loadFileFromPrivateGit');


module.exports = async function (config) {
    const proxy = new EnvProxy();
    const fileName = "public_ip.sh";
    const url = `https://raw.githubusercontent.com/${config['REPO_PATH']}/public_ip.sh`;

    try {
        log.info(`trying to download: ${url}`);
        await loadFileFromPrivateGit(url, fileName, config);
    } catch (error) {
        log.error(`could not load 'public_ip.sh' from ${url}`, error);
        throw error;
    }
    const connectionData = {};
    log.info(`making publish_ip.sh runnable.`);
    await proxy.changePermission_L(fileName, "+x");
    log.info(`runnung public_ip.sh`);
    try {
        await proxy.executeCommand_L(`./${fileName} ${config['TARGET_ENV']}`);
    }catch (error){
        log.error("", error);
    }

    const dataKeys = ['public_hostname', 'public_ip', 'admin_address', 'target_user', 'logstash_ip', 'public_scheme', 'public_port'];
    log.info(`gathering new dataKeys... `);
    for (const key of dataKeys) {
        if (process.env[key]) {
            log.info(`${key} is set`);
            connectionData[key] = process.env[key];
        } else {
            log.warn(`${key} is not set`);
        }
    }
    log.info(`... finished gathering dataKeys`);
    return connectionData;
};































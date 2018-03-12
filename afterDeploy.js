'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const fs = require('fs');
const loadConfigFile = require('./actions/loadConfigFile');
const runIntegrationTests = require('./actions/runIntegrationTests');
const rollback = require('./actions/rollbackService');

const exec = async function () {
    log.info("Running after deploy script");
    const config_file_name = "bp-config.json";
    const config = loadConfigFile(config_file_name);
    try {
        log.info("loaded config-file!");
        const proxy = await new EnvProxy().init(config);
        // buildscript line 235

        if (!await runIntegrationTests(config, proxy) || true) { // TODO: remove on rollout
            log.error("integration tests not successful - rollback!");
            await rollback(config, proxy);
        }
        require('./actions/saveObject2File')(config, config_file_name, true);
        proxy.close();
    } catch (error) {
        log.error(error);
        require('./actions/saveObject2File')(config, config_file_name, true);
    }
};

exec();
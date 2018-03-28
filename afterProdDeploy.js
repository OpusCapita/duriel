'use strict';
const fs = require('fs');
const EpicLogger = require('./EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('./EnvProxy');

const loadConfigFile = require('./actions/loadConfigFile');
const runIntegrationTests = require('./actions/runIntegrationTests');
const rollback = require('./actions/rollbackService');
const buildDocs = require('./actions/buildDocs');
const bumpVersion = require('./actions/bumpVersion');

module.exports = async function () {
    log.info("Running after prod deploy script");
    const config_file_name = "bp-config.json";
    const config = loadConfigFile(config_file_name);

    if(config['SKIP_DEPLOY2PROD']){ // flag from afterDeploy.js script
        log.info("skipping - no prod deployment was done.");
        process.exit(0);
    }

    if (!await runIntegrationTests(config, proxy)) {
        log.error("integration tests not successful - rollback!");
        await rollback(config, proxy);
    }
    await buildDocs();
    await bumpVersion(config);
};
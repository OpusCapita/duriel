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

    if (!await runIntegrationTests(config, proxy) || true) { // TODO: remove on rollout
        log.error("integration tests not successful - rollback!");
        await rollback(config, proxy);
    }
    await buildDocs();
    await bumpVersion(config);
};
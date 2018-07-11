'use strict';
const fs = require('fs');

const EpicLogger = require('./EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('./EnvProxy');
const loadConfigFile = require('./actions/filehandling/loadConfigFile');
const gitHelper = require('./actions/helpers/gitHelper');

const runIntegrationTests = require('./actions/runIntegrationTests');
const rollback = require('./actions/rollbackService');
const buildDocs = require('./actions/buildDocs');
const versionHandler = require('./actions/helpers/versionHelper');
const dockerCommandBuilder = require("./actions/docker/dockerCommandBuilder");

const exec = async function () {
    require('events').EventEmitter.prototype._maxListeners = 100;
    log.info("Running after prod deploy script");
    const config_file_name = "bp-config.json";
    const config = loadConfigFile(config_file_name);
    if (!config) {
        log.info("no config file could be loaded - ending step");
        return;
    }

    if (!config['INVOKE_DEPLOYMENT']) { // flag from bp_after_first_deployment.js script
        log.info("skipping - no prod deployment was done.");
        process.exit(0);
    }
    const proxy = await new EnvProxy().init(config);
    if (!await runIntegrationTests(config, proxy)) {
        log.error("integration tests not successful - rollback!");
        await rollback(config, proxy);
    }
    const compose_base = dockerCommandBuilder.dockerComposeBase();
    await buildDocs(compose_base, config, true);
    await gitHelper.setCredentials(config['GIT_USER'], config['GIT_EMAIL']);
    await versionHandler.bumpAndCommitVersionFile(); // undefined, undefined, undefined --> load the file, bump as 'patch', ${version} [ci skip] message

    proxy.close();
};

exec()
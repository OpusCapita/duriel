'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const loadConfigFile = require('./actions/filehandling/loadConfigFile');
const runIntegrationTests = require('./actions/runIntegrationTests');
const rollback = require('./actions/rollbackService');
const fileHandler = require('./actions/filehandling/fileHandler');
const gitHelper = require('./actions/helpers/gitHelper');
const dockerHelper = require('./actions/helpers/dockerHelper');
const cleanupSystem = require('./actions/cleanupSystem');

const buildDocs = require('./actions/buildDocs');
const versionHandler = require('./actions/helpers/versionHelper');
const dockerCommandBuilder = require("./actions/docker/dockerCommandBuilder");

const exec = async function handleDeployment() {
    require('events').EventEmitter.prototype._maxListeners = 100;
    log.info("Running after deploy script");
    const config_file_name = "bp-config.json";
    const config = loadConfigFile(config_file_name);
    if (!config) {
        log.info("no config file could be loaded - ending step");
        return;
    }
    try {
        log.info("connecting to environment...");
        const proxy = await new EnvProxy().init(config);
        log.debug("... done.");

        await runAfterDeploymentTests(config, proxy);
        await cleanupSystem(proxy, config);

        switch (config['TARGET_ENV']) {
            case 'prod':
                await handleProductionDeployment(config);
                break;
            case 'stage':
                await handleStageDeployment(config);
                break;
            case 'develop':
                await handleDevelopDeployment(config);
                break;
        }
        proxy.close();
    } catch (e) {
        log.error("Error in after_deployment", e);
        fileHandler.saveObject2File(config, config_file_name, true);
        process.exit(1);
    }
};

async function runAfterDeploymentTests(config, proxy) {
    if (!await runIntegrationTests(config, proxy)) {
        log.error("integration tests not successful - rollback!");
        await rollback(config, proxy);
    }
}

async function handleDevelopDeployment(config) {
    await dockerHelper.pushImage(config['HUB_REPO'], "dev");
    const compose_base = dockerCommandBuilder.dockerComposeBase();
    await buildDocs(compose_base, config);
}

async function handleStageDeployment(config) {
    const compose_base = dockerCommandBuilder.dockerComposeBase();
    await buildDocs(compose_base, config);
}

async function handleProductionDeployment(config) {
    const compose_base = dockerCommandBuilder.dockerComposeBase();
    await buildDocs(compose_base, config, true);
    await gitHelper.setCredentials(config['GIT_USER'], config['GIT_EMAIL']);
    await versionHandler.bumpAndCommitVersionFile(undefined, undefined, undefined, "master");
    await versionHandler.bumpAndCommitVersionFile(undefined, undefined, undefined, "develop");
}


exec();

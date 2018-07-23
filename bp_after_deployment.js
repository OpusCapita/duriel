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
const gitHubHelper = require('./actions/helpers/gitHubHelper');
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
    if (config['TARGET_ENV']) {
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
    }
    try {
        const pullRequestRules = [
            {rule: branch => branch.toLowerCase().startsWith("hotfix/")},
            {rule: branch => branch.toLowerCase().startsWith("release/")}
        ];

        if (pullRequestRules.filter(it => it.rule(config['CIRCLE_BRANCH']).length)) {
            const pullRequest = {
                title: "PullRequest from duriel-build-automation",
                body: "the deployment was successfull, please merge your changes!",
                head: config['CIRCLE_BRANCH'],
                base: "master",
                maintainer_can_modity: true
            };
            const response = await gitHubHelper.createPullRequest(config, pullRequest);
            if (response) {
                log.info(`### created pull-request! ###\nnumber: ${response.number}\nurl: ${response.url}}`)
            }
        } else {
            log.info(`no pull-request will be created for branch '${config['CIRCLE_BRANCH']}'`)
        }
    } catch (e) {
        log.error("could not open pull-request. You have to do it manually ¯\\_(ツ)_/¯ ", e);
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
    // TODO: open PR in github!
}

async function handleProductionDeployment(config) {
    const compose_base = dockerCommandBuilder.dockerComposeBase();
    await buildDocs(compose_base, config, true);
    await gitHelper.setCredentials(config['GIT_USER'], config['GIT_EMAIL']);

}


exec();

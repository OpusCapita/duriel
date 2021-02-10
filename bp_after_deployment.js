'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const loadConfigFile = require('./actions/filehandling/loadConfigFile');
const integrationTestHelper = require('./actions/helpers/IntegrationTestHelper');
const rollback = require('./actions/rollbackService');
const fileHandler = require('./actions/filehandling/fileHandler');
const gitHelper = require('./actions/helpers/gitHelper');
const dockerHelper = require('./actions/helpers/dockerHelper');
const gitHubHelper = require('./actions/helpers/gitHubHelper');
const cleanupSystem = require('./actions/cleanupSystem');

const buildDocs = require('./actions/buildDocs');
const versionHandler = require('./actions/helpers/versionHelper');
const dockerCommandBuilder = require("./actions/docker/dockerCommandBuilder");

const pullRequestRules = [
    {rule: branch => branch.toLowerCase().startsWith("hotfix/"), base: ['master', 'develop']},
    {rule: branch => branch.toLowerCase().startsWith("release/"), base: ['master']}
];

const exec = async function handleDeployment() {
    require('events').EventEmitter.prototype._maxListeners = 100;
    log.info("Running after deploy script");
    const config_file_name = "bp-config.json";
    let config;

    try {
        config = loadConfigFile(config_file_name)
    } catch (e) {
        // Do nothing :)
    }


    if (!config) {
        log.info("no config file could be loaded - ending step");
        return;
    }

    try {
        log.info(`Environment variable found: '${process.env['RABBITMQ_USER']}' ... `);
    } catch (e) {
        log.error("Error in after_deployment: variable finding failed:", e);
    }
    
    if (config['TARGET_ENV']) {
        try {
            log.info("connecting to environment...");
            const proxy = await new EnvProxy().init(config);
            log.debug("... done.");

            await runAfterDeploymentTests(config, proxy);
            
            if(Math.random() * 1e10 % 10 === 0) {
                await cleanupSystem(proxy, config);
            }

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

    await createPullRequests(config)
};

async function runAfterDeploymentTests(config, proxy) {
    if (!await integrationTestHelper.runIntegrationTests(config, proxy)) {
        log.error("integration tests not successful - rollback!");
        await rollback(config, proxy);
    }
}

async function handleDevelopDeployment(config) {
    await dockerHelper.pushImage(config['HUB_REPO'], "dev");
    await buildDocs.buildDocs(config, true)
        .catch(e => log.warn("ERROR while building docs! When deploying to prod this will lead to a failure!", e));
}

async function handleStageDeployment(config) {
    await buildDocs.buildDocs(config)
        .catch(e => log.warn("ERROR while building docs! When deploying to prod this will lead to a failure!", e));
    // TODO: open PR in github!
}

async function handleProductionDeployment(config) {
    await gitHelper.setCredentials(config['GIT_USER'], config['GIT_EMAIL']);
    await buildDocs.buildDocs(config)
        .catch(e => log.warn("ERROR while building docs! When deploying to prod this will lead to a failure!", e));

}

async function createPullRequests(config) {
    if (config.get('pull_request_creation_skip')) {
        log.warn("pull-request-creation is disabled via flag, skipping.");
        return;
    }
    try {
        const pullRequestsBranches = pullRequestRules.filter(it => it.rule(config['CIRCLE_BRANCH']));
        if (pullRequestsBranches.length) {
            for (const matchingRules of pullRequestsBranches) {
                try {
                    for (const base of matchingRules.base) {
                        const pullRequest = {
                            title: "Pull-Request from duriel-build-automation",
                            body: `Deployment of ${config['VERSION']} was successfull. Please merge your changes.`,
                            head: config['CIRCLE_BRANCH'],
                            base: base,
                            maintainer_can_modity: true
                        };
                        const response = await gitHubHelper.createPullRequest(config, pullRequest);
                        if (response) {
                            log.info(`### created pull-request! ###\nnumber: ${response.number}\nurl: ${response.url}}`)
                        }
                    }
                } catch (e) {
                    log.info(`no pull-request will be created for branch '${config['CIRCLE_BRANCH']}'`)
                }
            }
        } else {
            log.info(`no pull-request will be created for branch '${config['CIRCLE_BRANCH']}'`)
        }

    } catch (e) {
        log.error("could not open pull-request. You have to do it manually ¯\\_(ツ)_/¯ ", e);
    }
}

exec();

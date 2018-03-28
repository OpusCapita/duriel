'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const fs = require('fs');
const loadConfigFile = require('./actions/loadConfigFile');
const runIntegrationTests = require('./actions/runIntegrationTests');
const rollback = require('./actions/rollbackService');
const pushDockerImage = require('./actions/pushDockerImage');
const calculateVersion = require('./actions/calculateVersion');

const exec = async function () {
    log.info("Running after deploy script");
    const config_file_name = "bp-config.json";
    const config = loadConfigFile(config_file_name);
    try {
        log.info("loaded config-file!");
        const proxy = await new EnvProxy().init(config);

        if (!await runIntegrationTests(config, proxy) || true) { // TODO: remove on rollout
            log.error("integration tests not successful - rollback!");
            await rollback(config, proxy);
        }

        if (config['CIRCLE_BRANCH'] === "develop") {
            await pushDockerImage(config['HUB_REPO'], ["dev"], false, true) // don't tag but push!
            // TODO: in old bp a merge from develop to master
        }

        if (config['CIRCLE_BRANCH'] === "master" && config['TARGET_ENV'] === "stage") {
            log.info("PROD deployment is needed.");
            config['TARGET_ENV'] = "prod";
            log.info(`copying env-info for prod into config...`);
            for (const key in EnvInfo[config['TARGET_ENV']]) {
                config[`${key}`] = EnvInfo[config['andariel_branch']][`${key}`];
            }
            log.info(`...done.`);
            config['PREV_VERSION'] = config['VERSION'];
            config['VERSION'] = calculateVersion(config, true); // return raw from version file
            await pushDockerImage(config['HUB_REPO'], config['PREV_VERSION'], config['VERSION'], [config['VERSION']]);
        }
        require('./actions/saveObject2File')(config, config_file_name, true);
        proxy.close();
    } catch (error) {
        log.error(error);
        require('./actions/saveObject2File')(config, config_file_name, true);
    }
};

exec();
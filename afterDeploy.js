'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const loadConfigFile = require('./actions/filehandling/loadConfigFile');
const runIntegrationTests = require('./actions/runIntegrationTests');
const rollback = require('./actions/rollbackService');
const tagAndPushImage = require('./actions/docker/tagAndPushDockerImage');
const calculateVersion = require('./actions/calculateVersion');
const fileHandler = require('./actions/filehandling/fileHandler');
const getEnvVariables = require("./actions/getEnvVariables");
const calculateEnv = require("./actions/calculateEnv");

const BRANCHES_4_DEV_TAG = ['develop', 'nbp'];

const exec = async function () {
    log.info("Running after deploy script");
    const config_file_name = "bp-config.json";
    const config = loadConfigFile(config_file_name);
    log.info("loaded config-file!");
    try {
        log.info("connecting to environment...");
        const proxy = await new EnvProxy().init(config);
        log.debug("... done.");

        if (!await runIntegrationTests(config, proxy)) {
            log.error("integration tests not successful - rollback!");
            await rollback(config, proxy);
        }

        if (BRANCHES_4_DEV_TAG.includes(config['CIRCLE_BRANCH'])) {
            await tagAndPushImage(config['HUB_REPO'], null, null, "dev") // don't tag but push - TODO: in old bp a merge from develop to master
        }
        config['SKIP_SECOND_DEPLOYMENT'] = true;
        const nextEnv = calculateEnv.secondTargetEnv(config['CIRCLE_BRANCH']);
        if (nextEnv !== 'none') {
            log.info(`deployment to second env is needed. env: ${nextEnv}`);
            // config['SKIP_SECOND_DEPLOYMENT'] = false;
            config['TARGET_ENV'] = nextEnv;
            config['MYSQL_PW'] = getEnvVariables.getDatabasePassword(config);
            log.info(`copying env-info for ${nextEnv} into config...`);
            for (const key in EnvInfo[config['TARGET_ENV']]) {
                config[`${key}`] = EnvInfo[config['andariel_branch']][`${key}`];
            }
            log.info(`...done.`);
            config['PREV_VERSION'] = config['VERSION'];
            config['VERSION'] = calculateVersion(config, true); // return raw from version file
            await tagAndPushImage(config['HUB_REPO'], config['PREV_VERSION'], config['VERSION'], config['VERSION']);
        }
        fileHandler.saveObject2File(config, config_file_name, true);
        proxy.close();
    } catch (error) {
        log.error(error);
        fileHandler.saveObject2File(config, config_file_name, true);
        process.exit(1);
    }
};

exec();
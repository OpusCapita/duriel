'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const loadConfigFile = require('./actions/filehandling/loadConfigFile');
const runIntegrationTests = require('./actions/runIntegrationTests');
const rollback = require('./actions/rollbackService');
const calculateVersion = require('./actions/helpers/versionHelper');
const fileHandler = require('./actions/filehandling/fileHandler');
const getEnvVariables = require("./actions/getEnvVariables");
const calculateEnv = require("./actions/calculateEnv");
const dockerHelper = require('./actions/helpers/dockerHelper');

const BRANCHES_4_DEV_TAG = ['develop', 'nbp'];

const exec = async function () {
    log.info("Running after deploy script");
    const config_file_name = "bp-config.json";
    const config = loadConfigFile(config_file_name);
    if(!config){
        log.info("no config file could be loaded - ending step");
        return;
    }
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
            await dockerHelper.pushImage(config['HUB_REPO'], "dev");
        }
        config['INVOKE_DEPLOYMENT'] = false;
        const nextEnv = calculateEnv.secondTargetEnv(config['CIRCLE_BRANCH']);
        log.info(`second deployment will be targeted on '${nextEnv}'`);
        if (nextEnv !== 'none' && config['force_second_deployment']) {
            config['INVOKE_DEPLOYMENT'] = true;
            config['TARGET_ENV'] = nextEnv;
            config['MYSQL_PW'] = getEnvVariables.getDatabasePassword(config);
            log.info(`...done.`);
            if(calculateEnv.isMainVersionBranch(config['CIRCLE_BRANCH'])) { // determines if current branch will create a main-version (e.g. 1.1.1, 1.0.2) or will use dev-taged images
                config['PREV_VERSION'] = config['VERSION'];
                config['VERSION'] = calculateVersion.getRawVersion();
                await dockerHelper.tagAndPushImage(config['HUB_REPO'], config['PREV_VERSION'], config['VERSION'], config['VERSION']);
            }
        }
        fileHandler.saveObject2File(config, config_file_name, true);
        proxy.close();
    } catch (error) {
        log.error("Error in first after_deployment", error);
        fileHandler.saveObject2File(config, config_file_name, true);
        process.exit(1);
    }
};

exec();
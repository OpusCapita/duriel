'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');

const loadFile2Object = require('./actions/loadFile2Object');
const loadTaskTemplate = require('./actions/loadTaskTemplate');
const loadFileFromPrivateGit = require('./actions/loadFileFromPrivateGit');
const generateSecret = require('./actions/generateSecret');
const queryExecuter = require('./actions/queryExecuter');

const handleServiceDB = require('./actions/handleServiceDB');


const exec = async function () {
    const config_file_name = "bp-config.json";
    const config = loadFile2Object(config_file_name);
    try {
        if (!config) {
            log.error(`no config passed info deploy.js! config: ${config === null}`);
        }

        let paramsMissing = false;
        if (!config['GIT_TOKEN']) {
            paramsMissing = true;
            log.error("GIT_TOKEN missing!")
        }

        if (!config['CIRCLE_PROJECT_REPONAME']) {
            paramsMissing = true;
            log.error("CIRCLE_PROJECT_REPONAME missing!")
        }

        if (paramsMissing) {
            log.error("params are missing! exiting!");
            process.exit(1);
        }
        log.info(`copying data from envInfo into config`);
        // const envInfo = ;
        for (const key in EnvInfo[config['andariel_branch']]) {
            log.info(`copying ${key}`);
            config[`${key}`] = EnvInfo[config['andariel_branch']][`${key}`];
        }

        log.info("loading task template...");
        await loadTaskTemplate(config);
        log.info("...finished task template");

        try {
            log.info("loading field_defs.json");
            const field_defs_url = `https://raw.githubusercontent.com/${config['REPO_PATH']}/field_defs.json`;
            const field_defs_file = './field_defs.json';
            await loadFileFromPrivateGit(field_defs_url, field_defs_file, config);
            log.info("finished loading field_defs.json");
        } catch (err) {
            log.error("error while downloading file")
        }

        try {
            log.info("loading build_docker_command.sh");
            const build_docker_url = `https://raw.githubusercontent.com/${config['REPO_PATH']}/build_docker_command.sh`;
            const build_docker_file = './build_docker_command.sh';
            await loadFileFromPrivateGit(build_docker_url, build_docker_file, config);
            log.info("finished loading building_docker_command.sh");
        } catch (err) {
            log.error("error while downloading file")
        }

        const proxy = await new EnvProxy().init(config);
        log.info(`establishing proxy to enviroment ${config['andariel_branch']}`);
        config['dependsOnServiceClient'] = require('./actions/dependsOnServiceClient')();
        if (!config['dependsOnServiceClient'] && false) {   // TODO: remove me on production
            log.info("project does not depend on service-client. skipping key injection");
        } else {
            config['svcUserName'] = `svc_${config['serviceName']}`;
            config['svcUserPassword'] = proxy.executeCommand_L(`openssl rand -base64 32`);
            const injectionSuccessfull = await require('./actions/setupServiceUser')(config, proxy);
            log.info(`finished setupServiceUser - success = ${injectionSuccessfull}`);
        }

        await handleServiceDB(config, proxy, true);

        //await generateSecret(true, config, proxy); // TODO used later... somewhere

        require('./actions/saveObject2File')(config, config_file_name, true);
        await proxy.close();
    } catch (error) {
        console.error(error);
        // log.error(error);
        require('./actions/saveObject2File')(config, config_file_name, true);
    }
};

exec();






















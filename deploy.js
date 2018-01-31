'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');

const loadFile2Object = require('./actions/loadFile2Object');
const loadTaskTemplate = require('./actions/loadTaskTemplate');
const loadFileFromPrivateGit = require('./actions/loadFileFromPrivateGit');
const generateSecret = require('./actions/generateSecret');

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

        await loadTaskTemplate(config);

        const field_defs_url = `https://raw.githubusercontent.com/${config['REPO_PATH']}/field_defs.json`;
        const field_defs_file = './field_defs.json';
        loadFileFromPrivateGit(field_defs_url, field_defs_file, config);

        const build_docker_url = `https://raw.githubusercontent.com/${config['REPO_PATH']}/build_docker_command.sh`;
        const build_docker_file = './build_docker_command.sh';
        loadFileFromPrivateGit(build_docker_url, build_docker_file, config);

        const proxy = new EnvProxy();
        log.info(`establishing proxy to enviroment ${config['andariel_branch']}`);
        await proxy.init(config);

        //await generateSecret(true, config, proxy); // TODO used later... somewhere

        config['dependsOnServiceClient'] = require('./actions/dependsOnServiceClient')()

        if (!config['dependsOnServiceClient']) {
            log.info("project does not depend on service-client. skipping key injection");
        } else {
            config['svcUserName'] = `svc_${config['serviceName']}`;
            config['svcUserPassword'] = proxy.executeCommand_L(`openssl rand -base64 32`);

        }

        require('./actions/saveObject2File')(config, config_file_name, true);
        await proxy.close();
    } catch (error) {
        log.error(error);
        require('./actions/saveObject2File')(config, config_file_name, true);
    }
};

exec();






















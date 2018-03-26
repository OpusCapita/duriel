'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const fs = require('fs');

const loadTaskTemplate = require('./actions/loadTaskTemplate');
const loadFileFromPrivateGit = require('./actions/loadFileFromPrivateGit');
const generateSecret = require('./actions/generateSecret');

const handleServiceDB = require('./actions/handleServiceDB');
const dependsOnServiceClient = require('./actions/dependsOnServiceClient');
const injectConsulServiceCredentials = require('./actions/injectConsulServiceCredentials');
const dockerCommandBuilder = require('./actions/dockerCommandBuilder');
const doConsulInjection = require('./actions/doConsulInjection');
const loadConfigFile = require('./actions/loadConfigFile');
const monitorDockerContainer_E = require('./actions/monitorDockerContainer_E');
const waitForTests = require('./actions/waitForRunningTests');
const setupServiceUser = require('./actions/setupServiceUser');
const dockerLogin = require('./actions/dockerLogin_E');


const exec = async function () {
    try {
        const config_file_name = "bp-config.json";
        const config = loadConfigFile(config_file_name);
        if (!config) {
            log.error(`config missing!`);
            process.exit(1);
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

        if (!EnvInfo[config['TARGET_ENV']]) {
            paramsMissing = true;
            log.error(`no env-info for branch '${config['andariel_branch']}' found`);
        }

        if (paramsMissing) {
            log.error("params are missing! exiting!");
            process.exit(1);
        }

        log.info(`copying data from envInfo into config`);
        for (const key in EnvInfo[config['TARGET_ENV']]) {
            log.info(`copying ${key}`);
            config[`${key}`] = EnvInfo[config['TARGET_ENV']][`${key}`];
        }

        log.info("loading task template...");
        await loadTaskTemplate(config);
        log.info("...finished task template");

        const field_defs_url = `https://raw.githubusercontent.com/${config['REPO_PATH']}/field_defs.json`;
        const field_defs_file = './field_defs.json';
        try {
            log.info("loading field_defs.json");
            await loadFileFromPrivateGit(field_defs_url, field_defs_file, config)
                .then(() => {
                    log.info("finished loading field_defs.json");
                });

        } catch (err) {
            log.error(`error while downloading field_defs file`, err);
            process.exit(1);
        }

        config['serviceSecretName'] = `${config['serviceName']}-consul-key`;
        config['serviceSecret'] = "";

        const proxy = await new EnvProxy().init(config);
        log.info(`established proxy to enviroment ${config['andariel_branch']}`);
        config['dependsOnServiceClient'] = await dependsOnServiceClient();
        if (!config['dependsOnServiceClient']) {
            log.info("project does not depend on service-client. skipping name injection");
        } else {
            log.info("project depends on service-client.");
            config['svcUserName'] = `svc_${config['serviceName']}`;
            config['svcUserPassword'] = await proxy.executeCommand_L(`openssl rand -base64 32`);
            const setupServiceUserSuccess = await setupServiceUser(config, proxy);
            log.info(`finished setupServiceUser - success = ${setupServiceUserSuccess}`);
            if (setupServiceUserSuccess) {
                log.info("Service user does exist. checking for matching consul name....");
                await injectConsulServiceCredentials(config, proxy);
            }
        }

        log.info("loading service informations"); // docker service inspect
        const serviceInformation = JSON.parse(await proxy.executeCommand_E(`docker service inspect ${config['CIRCLE_PROJECT_REPONAME']}`));     // TODO: throwa error instead of false
        await require('./actions/saveObject2File')(serviceInformation, './service_config.json', true);  //
        log.info("saved service information into 'service_config.json'");
        let dockerCommand;
        let isCreateMode = serviceInformation && serviceInformation.length === 0;
        log.info(`creating dockerCommand in ${isCreateMode ? 'CreateMode' : 'UpdateMode' }`);
        if (isCreateMode) {
            log.info(`service not found on '${config['TARGET_ENV']}' --> running create mode`);
            if (!fs.fileExistsSync('./task_template_mapped.json')) {
                log.info(`service not found on '${config['TARGET_ENV']}', create mode unsupported`);
            } else {
                log.info("drop/creating the service secret");
                const generatedSecret = await generateSecret(false, config, proxy);
                config['serviceSecret'] = generatedSecret.serviceSecret;
                config['secretId'] = generatedSecret.secretId;
                await handleServiceDB(config, proxy, true); // param true is idiotic, as it is set in old buildprocess as default
                dockerCommand = dockerCommandBuilder.dockerCreate(config);
            }
        } else {
            log.info(`service exists on ${config['TARGET_ENV']}, going to run update mode`);
            await handleServiceDB(config, proxy, true);
            log.info("Trying to fetch secrets from target env.");
            const fetchedSecrets = await proxy.readDockerSecretOfService_E(config['serviceName'], `${config['serviceName']}-consul-key`);
            const addSecret = fetchedSecrets.length !== 1;
            if (addSecret) {
                log.warn(`was not able to get unique secret from env (got values(first 4 chars): [${fetchedSecrets.map(it => it.substring(0, 4)).join(', ')}]), generating`);
                const secrets = await generateSecret(true, config, proxy);
                config['serviceSecret'] = secrets.serviceSecret;
                config['serviceId'] = secrets.serviceId;
            } else {
                log.info("service secret retrieved from running instance.");
                config['serviceSecret'] = fetchedSecrets[0];
            }
            dockerCommand = dockerCommandBuilder.dockerUpdate(config, addSecret);
        }
        log.info(`docker command is ${dockerCommand}`);
        await doConsulInjection(config, proxy);

        await dockerLogin(config, proxy);
        config['DS2'] = dockerCommand;

        log.error("worked until docker login e");
        process.exit(0);

        const syncToken = await waitForTests(config, proxy);

        log.info(`executing dockerCommand ... `);
        // TODO: add on rollout execute on env
        // await proxy.executeCommand_E(dockerCommand);

        const monitorResult = await monitorDockerContainer_E(config, proxy, isCreateMode, serviceInformation[0].ID); // mark actions on ENV or LOCAL, etc.
        if (monitorResult === 'failure') {
            throw new Error("service not healthy after deployment!");
        }
        if (syncToken) {
            log.info("Removing syncToken from CircleCi");
            await waitForTests.removeSyncToken(config, proxy, syncToken);
        }

        await setupServiceUser(config, proxy, false);
        require('./actions/saveObject2File')(config, config_file_name, true);
        await proxy.close();
    } catch (error) {
        log.error("ERROR!", error);
        process.exit(1);
    }
};

exec();






















'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const fs = require('fs');

const fileHandler = require('./actions/filehandling/fileHandler');
const generateSecret = require('./actions/docker/generateDockerSecret');

const handleServiceDB = require('./actions/database/createServiceDB');
const dependsOnServiceClient = require('./actions/dependsOnServiceClient');
const injectConsulServiceCredentials = require('./actions/injectConsulServiceCredentials');
const dockerCommandBuilder = require('./actions/docker/dockerCommandBuilder');
const doConsulInjection = require('./actions/doConsulInjection');
const loadConfigFile = require('./actions/filehandling/loadConfigFile');
const monitorDockerContainer_E = require('./actions/docker/monitorDockerContainer_E');
const e2eTester = require('./actions/e2eTester');
const setupServiceUser = require('./actions/database/createServiceUser');
const dockerHelper = require('./actions/helpers/dockerHelper');
const rollback = require('./actions/rollbackService');


const exec = async function () {
    try {
        require('events').EventEmitter.prototype._maxListeners = 100;
        const config_file_name = "bp-config.json";
        const config = loadConfigFile(config_file_name);
        if (!config) {
            log.info("no config file could be loaded - ending step");
            return;
        }

        if(!config['TARGET_ENV']){
            log.info("no deployment to env needed.");
            process.exit(0);
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
            log.info(`no env-info for branch '${config['andariel_branch']}' found`);
            process.exit(0);
        }

        if (paramsMissing) {
            log.error("params are missing! exiting!");
            process.exit(1);
        }

        log.info(`copying data from envInfo into config`);
        for (const key in EnvInfo[config['TARGET_ENV']]) {
            log.debug(`copying ${key}`);
            config[`${key}`] = EnvInfo[config['TARGET_ENV']][`${key}`];
        }

        log.info("loading task template...");
        await fileHandler.loadTaskTemplate(config);
        log.debug("...finished task template");

        config['serviceSecretName'] = `${config['serviceName']}-consul-key`;
        config['serviceSecret'] = "";

        const proxy = await new EnvProxy().init(config);
        await dockerHelper.loginEnv(config, proxy);
        log.info(`established proxy to environment ${config['andariel_branch']}`);
        config['dependsOnServiceClient'] = await dependsOnServiceClient();
        if (!config['dependsOnServiceClient']) {
            log.info("project does not depend on service-client. skipping name injection");
        } else {
            log.info("project depends on service-client.");
            const setupServiceUserSuccess = await setupServiceUser(config, proxy);
            log.info(`finished setupServiceUser - success = ${setupServiceUserSuccess}`);
            if (setupServiceUserSuccess) {
                log.info("Service user does exist. checking for matching consul name....");
                await injectConsulServiceCredentials(config, proxy);
            }
        }

        log.info("loading service informations"); // docker service inspect
        const serviceInformation = await proxy.getServiceInspect_E(config['CIRCLE_PROJECT_REPONAME']);
        await fileHandler.saveObject2File(serviceInformation, './service_config.json', true);
        log.debug("saved service information into 'service_config.json'");

        let dockerCommand;
        const isCreateMode = !serviceInformation;
        config['isCreateMode'] = isCreateMode;
        if (isCreateMode) {
            log.info(`service not found on '${config['TARGET_ENV']}' --> running create mode`);
            if (!fs.existsSync('./task_template_mapped.json')) {
                log.info(`service not found on '${config['TARGET_ENV']}', create mode unsupported`);
                process.exit(1);
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
                //const secrets = await generateSecret(true, config, proxy);
                //config['serviceSecret'] = secrets.serviceSecret;
                //config['serviceId'] = secrets.serviceId;
            } else {
                log.debug("service secret retrieved from running instance.");
                config['serviceSecret'] = fetchedSecrets[0];
            }
            // dockerCommand = dockerCommandBuilder.dockerUpdate(config, addSecret);
            dockerCommand = dockerCommandBuilder.dockerUpdate(config, false); // TODO: remove me
        }
        log.info(`docker command is: `, dockerCommand);
        await doConsulInjection(config, proxy);
        config['DS2'] = dockerCommand;

        const testToken = await e2eTester.prepareE2ETests(config, proxy);
        if (testToken) {
            log.info(`Preparing E2E result:`, testToken);
            if (testToken['testStatus'] === 'running') {
                const waitToken = await e2eTester.waitForTest(config);
                log.debug(`e2e token after waiting for test: `, waitToken);
            }
        }

        log.info(`Login for Docker: '${config['DOCKER_USER']}', executing dockerCommand ... `);
        const commandResponse = await proxy.executeCommand_E(`docker login -u ${config['DOCKER_USER']} -p ${config['DOCKER_PASS']} ; ${dockerCommand}`);
        log.debug("command execution got response: ", commandResponse);
        if(!commandResponse ){
            throw new Error("no response for docker command");
        }
        const loginSucceded = commandResponse.includes("Login Succeeded");
        if(!loginSucceded){
            throw new Error("invalid docker login.");
        }

        const commandResponseSplit = commandResponse.split("Login Succeeded");
        const successPart = commandResponseSplit.length && commandResponseSplit[commandResponseSplit.length -1].trim();
        if(!successPart || successPart.trim() !== config['CIRCLE_PROJECT_REPONAME']){
            throw new Error("command response is not the reponame, this means docker did not accept the command but also did not throw an error...");
        }

        log.info("monitoring service after command-execution");
        const monitorResult = await monitorDockerContainer_E(config, proxy, isCreateMode); // mark actions on ENV or LOCAL, etc.
        if (monitorResult === 'failure') {
            log.error("service unhealthy after deployment, starting rollback!");
            if (testToken && testToken['syncToken'])
                await e2eTester.removeSyncToken(config, proxy, testToken['syncToken']);
            await rollback(config, proxy);
        } else {
            log.info(`Monitoring exited with status: '${monitorResult}'`);
        }

        if (testToken && testToken['syncToken']) {
            await e2eTester.removeSyncToken(config, proxy, testToken['syncToken']);
            const e2eTestStatus = await e2eTester.getTestStatus(config, proxy);
            log.info(`last e2e-test:'${e2eTestStatus['testNumber']}', waiting for e2e-test: '${testToken ? testToken['testNumber'] : ''}'`);
            if (testToken['testNumber'] !== e2eTestStatus['testNumber']) {
                log.info(`last e2e test was not the one we were waiting for. triggering new e2e test run!`);
                await e2eTester.triggerE2ETest(config);    // add rollback on failure?
            }
            await e2eTester.waitForTest(config)
        }

        await setupServiceUser(config, proxy, false);
        await fileHandler.saveObject2File(config, config_file_name, true);
        await proxy.close();
    } catch (error) {
        log.error("ERROR!", error);
        process.exit(1);
    }
};

exec();

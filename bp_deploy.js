'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const fs = require('fs');

const versionValidator = require('./actions/versionValidator');

const fileHandler = require('./actions/filehandling/fileHandler');
const dockerSecretHelper = require('./actions/helpers/dockerSecretHelper');

const handleServiceDB = require('./actions/database/createServiceDB');
const dependsOnServiceClient = require('./actions/dependsOnServiceClient');
const dockerCommandBuilder = require('./actions/docker/dockerCommandBuilder');
const doConsulInjection = require('./actions/doConsulInjection');
const loadConfigFile = require('./actions/filehandling/loadConfigFile');
const loadTaskTemplate = require('./actions/filehandling/loadTaskTemplate');
const monitorDockerContainer_E = require('./actions/docker/monitorDockerContainer_E');
const bn_e2eTester = require('./actions/bn_e2eTester');
const setupServiceUser = require('./actions/database/updateServiceClientUser');
const dockerHelper = require('./actions/helpers/dockerHelper');
const rollback = require('./actions/rollbackService');


const exec = async function () {
    try {
        require('events').EventEmitter.prototype._maxListeners = 100;
        const config_file_name = "bp-config.json";
        let config;
        try {
            config = loadConfigFile(config_file_name);
        } catch (e) {
            log.info("no config file could be loaded - ending step");
            return;
        }

        if (!config['TARGET_ENV']) {
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
        const taskTemplate = await loadTaskTemplate(config);
        log.debug("...finished task template");

        if(config.fromProcessEnv('ignore_limit') || taskTemplate['oc-infra-service']){
            log.info('limit-cpu and limit-memory are ignored, this flag will be soon removed!');
        } else {
            /* Remove requirement for limit-cpu
            if(typeof taskTemplate['limit-cpu'] === "undefined"){
                log.warn(`Required limit-cpu is not set in task template - please set it, have in mind that also other services are running on same node`);
                process.exit(1);
            }
            */
    
            if(typeof taskTemplate['limit-memory'] === "undefined"){
                log.warn(`Required limit-memory is not set in task template - please set it, have in mind that also other services are running on same node`);
                process.exit(1);
            }
        }

        config['serviceSecretName'] = `${config['serviceName']}-consul-key`;
        if(taskTemplate['oc-infra-service']) {
            config['serviceSecretName'] = `${taskTemplate['name']}-consul-key`;
        }
        config['serviceSecret'] = "";

        const proxy = await new EnvProxy().init(config);

        log.info("Checking version dependencies... ");
        if (config.get('skip_version_validation'))
            log.warn("'skip_version_validation' is used.");
        else
            await versionValidator.checkVersionDependencies(config, proxy);
        log.info("... finished checking version dependencies");


        await dockerHelper.loginEnv(config, proxy);
        log.info(`established proxy to environment ${config['andariel_branch']}`);
        config['dependsOnServiceClient'] = taskTemplate['oc-service-user-create-override'] || await dependsOnServiceClient();
        if (!config['dependsOnServiceClient']) {
            log.info("project does not depend on service-client. skipping name injection");
        } else {
            log.info("project depends on service-client.");
            const setupServiceUserSuccess = await setupServiceUser(config, proxy, false);
            log.info(`finished setupServiceUser - newUser = ${setupServiceUserSuccess}`);
        }

        log.info("loading service informations"); // docker service inspect
        const serviceInformation = taskTemplate['oc-infra-service'] ? await proxy.getInfraServiceInspect_E(config['CIRCLE_PROJECT_REPONAME']) : await proxy.getServiceInspect_E(config['CIRCLE_PROJECT_REPONAME']);
        await fileHandler.saveObject2File(serviceInformation, './service_config.json', true);
        log.debug("saved service information into 'service_config.json'");

        let dockerCommand;
        const isCreateMode = !serviceInformation;
        config['isCreateMode'] = isCreateMode;

        config['serviceSecrets'] = await dockerSecretHelper.getSecretsForDockerCommands(config, proxy);

        await dockerSecretHelper.createDockerSecrets(config, proxy, 'createdBy=duriel', 'source=task_template', `createdFor=${config['serviceName']}`);
        if(taskTemplate['oc-infra-service']) {
            if(!isCreateMode && serviceInformation.length > 1){
                log.warn(`more than one infra-service exists please finish previous upgrade and remove old version before deploying new one!`);
                process.exit(1);
            }
            log.info(`infra service --> running create mode`);
            if (!fs.existsSync('./task_template.json')) {
                log.info(`no task_template found, create mode unsupported`);
                process.exit(1);
            } else {
                log.info("drop/creating the service secret");
                const generatedSecret = await dockerSecretHelper.replace(proxy, config['serviceSecretName']);
                config['serviceSecret'] = generatedSecret.serviceSecret;
                config['secretId'] = generatedSecret.secretId;
                await handleServiceDB(config, proxy, true); // param true is idiotic, as it is set in old buildprocess as default
                dockerCommand = dockerCommandBuilder.dockerCreate(config);
            }
        } else {
            if (isCreateMode) {
                log.info(`service not found on '${config['TARGET_ENV']}' --> running create mode`);
                if (!fs.existsSync('./task_template.json')) {
                    log.info(`no task_template found, create mode unsupported`);
                    process.exit(1);
                } else {
                    log.info("drop/creating the service secret");
                    
                    const generatedSecret = await dockerSecretHelper.replace(proxy, config['serviceSecretName']);
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
        }
        log.info(`docker command is: `, dockerCommand);
        await doConsulInjection(config, proxy);

        const bn_testToken = await bn_e2eTester.prepareE2ETests(config, proxy);

        log.info(`Login for Docker: '${config['DOCKER_USER']}', executing dockerCommand ... `);
        const commandResponse = await proxy.executeCommand_E(`docker login -u ${config['DOCKER_USER']} -p ${config['DOCKER_PASS']} ; ${dockerCommand}`);
        log.debug("command execution got response: ", commandResponse);

        if(!taskTemplate['oc-infra-service']) {
            log.info("monitoring service after command-execution");
            const monitorResult = await monitorDockerContainer_E(config, proxy, isCreateMode); // mark actions on ENV or LOCAL, etc.
            if (monitorResult === 'failure') {
                log.error("service unhealthy after deployment, starting rollback!");
                await rollback(config, proxy);
            } else
                log.info(`E2E - Monitoring exited with status: '${monitorResult}'`);

            if (bn_testToken) {
                const e2eTestStatus = await bn_e2eTester.getTestStatus(config, proxy);
                log.info(`last e2e-test:'${e2eTestStatus['testNumber']}', waiting for e2e-test: '${bn_testToken ? bn_testToken['testNumber'] : ''}'`);
                if (bn_testToken['testNumber'] !== e2eTestStatus['testNumber'] || !['running', 'queued'].includes(e2eTestStatus['status'])) {
                    log.info(`triggering a new e2e test run!`);
                    await bn_e2eTester.triggerE2ETest(config);    // add rollback on failure?
                }
                await bn_e2eTester.waitForTest(config);
            }
        }
        if (config['dependsOnServiceClient']) {
            await setupServiceUser(config, proxy);
        }
        await fileHandler.saveObject2File(config, config_file_name, true);
        await proxy.close();
    } catch (error) {
        log.error("ERROR!", error);
        process.exit(1);
    }
};

exec();

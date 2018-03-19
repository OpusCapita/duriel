'use strict';
const Logger = require('./EpicLogger');
const log = new Logger();
const EnvProxy = require('./EnvProxy');
const EnvInfo = require('./envInfo');
const fs = require('fs');

const loadTaskTemplate = require('./actions/loadTaskTemplate');
const loadFileFromPrivateGit = require('./actions/loadFileFromPrivateGit');
const generateSecret = require('./actions/generateSecret');
const queryExecuter = require('./actions/queryExecuter');

const handleServiceDB = require('./actions/handleServiceDB');
const injectServiceClientUser = require('./actions/injectServiceClientUser');
const dockerCommandBuilder = require('./actions/dockerCommandBuilder');
const doConsulInjection = require('./actions/doConsulInjection');
const loadConfigFile = require('./actions/loadConfigFile');
const monitorDockerContainer_E = require('./actions/monitorDockerContainer_E');
const waitForTests = require('./actions/waitForRunningTests');
const setupServiceUser = require('./actions/setupServiceUser');


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
        log.info("finished loading field_defs.json");

        config['serviceSecretName'] = `${config['serviceName']}-consul-key`;
        config['serviceSecret'] = "";

        //
        log.error("worked until envproxy connection");
        process.exit(0);

        const proxy = await new EnvProxy().init(config);
        log.info(`establishing proxy to enviroment ${config['andariel_branch']}`);
        config['dependsOnServiceClient'] = require('./actions/dependsOnServiceClient')();
        if (!config['dependsOnServiceClient']) {   // TODO: remove me on production
            log.info("project does not depend on service-client. skipping name injection");
        } else {
            config['svcUserName'] = `svc_${config['serviceName']}`;
            config['svcUserPassword'] = await proxy.executeCommand_L(`openssl rand -base64 32`);
            const setupServiceUserSuccess = await setupServiceUser(config, proxy);
            log.info(`finished setupServiceUser - success = ${setupServiceUserSuccess}`);
            if (setupServiceUserSuccess) {
                log.info("Service user does exist. checking for matching consul name....");
                await injectServiceClientUser(config, proxy);
            }
        }
        await handleServiceDB(config, proxy, true);

        log.info("loading service informations"); // docker service inspect
        const serviceInformation = JSON.parse(await proxy.executeCommand_E(`docker service inspect ${config['CIRCLE_PROJECT_REPONAME']}`));
        await require('./actions/saveObject2File')(serviceInformation, './service_config.json', true);  //
        log.info("saved service information into 'service_config.json'");

        let dockerCommand;
        let isCreateMode = false;
        if (serviceInformation && serviceInformation.length === 0) {        // TODO: maybe check
            log.info(`service not found on '${config['TARGET_ENV']}' --> running create mode`);
            if (!fs.fileExistsSync('./task_template_mapped.json')) {
                log.info(`service not found on '${config['TARGET_ENV']}', create mode unsupported`);
            } else {
                log.info("drop/creating the service secret");
                const secrets = await generateSecret(false, config, proxy);
                config['serviceSecret'] = secrets.serviceSecret;
                config['secretId'] = secrets.secretId;
                await handleServiceDB(config, proxy, true); // param true is idiotic, as it is set in old buildprocess as default
                dockerCommand = dockerCommandBuilder.dockerCreate(config);
                // TODO: finish me!
            }
        } else {
            log.info(`service exists on ${config['TARGET_ENV']}, going to run update mode`);
            await handleServiceDB(config, proxy, true); // TODO: add on rollout
            // TODO: line 230 --> unklar
            log.info("Trying to fetch secrets from target env.");
            const serviceTasks = await proxy.getTasksOfServices_E(config['serviceName'], true);
            const fetchedSecrets = [];
            log.info(`found ${serviceTasks.length} tasks for service '${config['serviceName']}'`);
            for (let task of serviceTasks) {
                const containers = await proxy.getContainersOfService_N(task.node, config['serviceName'], true);
                log.info(`node '${task.node}' has ${containers.length} containers for service '${config['serviceName']}'`);
                for (let container of containers) {
                    log.info(`fetching service secret from node '${task.node}' for container '${container.containerId}'`);
                    const command = `docker exec ${container.containerId} cat /run/secret/${config['serviceName']}-consul-key`;
                    const secret = await proxy.executeCommand_N(task.node, command);
                    if (secret) {
                        fetchedSecrets.push(new RegExp(/^\S+/).exec(secret));   // first value before whitespace
                    }
                }
            }
            if (!fetchedSecrets.length !== 1) {
                log.warn("was not able to get secret from env, generating");
                // const secrets = await generateSecret(true, config, proxy); // TODO: remove on rollout
                // config['serviceSecret'] = secrets.serviceSecret;
                // config['serviceId'] = secrets.serviceId;
            } else {
                log.info("service secret retrieved from running instance.");
                config['serviceSecret'] = fetchedSecrets[0];
            }

            if (!fs.existsSync('./task_template_mapped.json')) {
                log.info("no task_template_mapped found. using simple update mode (only updating to new image");
                dockerCommand = "docker service update --force --image";
            } else {
                dockerCommand = dockerCommandBuilder.dockerUpdate(config);
                log.info(dockerCommand);
            }
        }
        log.info(`docker command is ${dockerCommand}`);
        await doConsulInjection(config, proxy);

        // prepare to execute docker command line 333 in old deploy.sh
        const dockerLoginPart = `docker login -u ${config['DOCKER_USER']} -p ${config['DOCKER_PASS']}`;
        config['DS2'] = `${dockerLoginPart} & ${dockerCommand}`;    // stupid name...
        // wait for e2e tests if necessary
        const syncToken = await waitForTests(config, proxy);

        // TODO: add on rollout execute on env
        // await proxy.executeCommand_E(dockerCommand);

        const monitorResult = await monitorDockerContainer_E(config, proxy, isCreateMode, serviceInformation[0].ID); // mark actions on ENV or LOCAL, etc.
        if (monitorResult === 'failure') {
            throw new Error("service not healthy after deployment!")
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






















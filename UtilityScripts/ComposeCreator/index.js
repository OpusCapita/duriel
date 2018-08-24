'use strict';
const extend = require('extend');
const yaml = require('yaml').default;

const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

const EnvProxy = require('../../EnvProxy');
const envInfo = require('../../envInfo');

const fileHelper = require('../../actions/filehandling/fileHandler');
const versionHelper = require('../../actions/helpers/versionHelper');
const libraryHelper = require('../../actions/helpers/libraryHelper');

const getBaseConfig = require('../../actions/getEnvVariables').getBaseConfigObject;
const loadTaskTemplate = require('../../actions/filehandling/loadTaskTemplate');

async function exec() {

    const config = getBaseConfig({serviceName: process.argv[2], TARGET_ENV: process.argv[3]});

    const taskTemplate = loadTaskTemplate(config['TARGET_ENV'])
    const s2sDependencies = await libraryHelper.fetchServiceVersionDependencies(config, taskTemplate);
    log.info("s2s", s2sDependencies);

    const proxy = await new EnvProxy().init(envInfo.develop);
    const l2sDependencies = await libraryHelper.fetchLibrary2ServiceDependencies(proxy)
    log.info("l2s", l2sDependencies);

    const serviceDependencies = extend(true, {}, s2sDependencies, ...l2sDependencies.map(it => it.serviceDependencies));

    log.info("serviceDependencies", serviceDependencies);

    const main = createMainEntry(config, taskTemplate, serviceDependencies);

    const result = {
        version: 2,
        services: {main}
    };

    for (const service in serviceDependencies) {
        result.services[service] = getServiceBaseConfig(service);
    }

    log.info(yaml.stringify(result));
    proxy.close();
}

function createMainEntry(config, taskTemplate, dependencies) {
    const result = {
        image: `opuscapita/${config['serviceName']}`,
        depends_on: Object.keys(dependencies),
        links: ["consul"],
        labels: {SERVICE_NAME: config['serviceName']},
    };

    if (taskTemplate.env) {
        const envEntries = {};
        for (const entry of taskTemplate.env) {
            const split = entry.split('=');
            envEntries[split[0]] = split[1];
        }
        result.enviroments = envEntries;
    }
    return result;

}

function getServiceBaseConfig(serviceName) {
    return {
        image: `opuscapita/${serviceName}`,
        links: ["consul"],
        labels: {SERVICE_NAME: serviceName}
    };

}


exec();
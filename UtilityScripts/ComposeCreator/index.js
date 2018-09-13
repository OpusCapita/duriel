'use strict';
const extend = require('extend');
const yaml = require('yaml').default;
const request = require('superagent');
const semver = require('semver');

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

    if (process.argv.length < 4)
        throw new Error("usage: <serviceName> <target_env>");

    const config = getBaseConfig({serviceName: process.argv[2], TARGET_ENV: process.argv[3]});

    const taskTemplate = loadTaskTemplate(config);
    log.info("tt", taskTemplate)
    const s2sDependencies = await libraryHelper.fetchServiceVersionDependencies(config, taskTemplate);
    log.info("s2s", s2sDependencies);

    const proxy = await new EnvProxy().init(envInfo.develop);
    //const l2sDependencies = await libraryHelper.fetchLibrary2ServiceDependencies(proxy);
    //log.info("l2s", l2sDependencies);

    //const serviceDependencies = extend(true, {}, s2sDependencies, ...l2sDependencies.map(it => it.serviceDependencies));
    const serviceDependencies = extend(true, {}, s2sDependencies);

    log.info("serviceDependencies", serviceDependencies);

    const main = createMainEntry(config, taskTemplate, serviceDependencies);

    const result = {
        version: 2,
        services: {main}
    };

    for (const service in serviceDependencies) {
        result.services[service] = await getServiceBaseConfig(service, serviceDependencies[service]);
    }


    const baseServices = getBaseServices();
    for (const service in baseServices) {
        result.services[service] = baseServices[service];
    }

    log.info(yaml.stringify(result));
    proxy.close();
}

async function getMinimalSupportedVersion(imageName, semVerValue) {
    return await loadImageVersions(imageName)
        .then(versions => versions.filter(it => semver.valid(it) && semver.satisfies(it, semVerValue)))
        .then(filtered => semver.sort(filtered))
        .then(sorted => sorted[0]);
}

async function loadImageVersions(imageName) {
    return await request.get(`https://registry.hub.docker.com/v1/repositories/${imageName}/tags`)
        .then(response => response.body)
        .then(tags => tags.map(it => it.name));
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

async function getServiceBaseConfig(serviceName, semVer) {
    const repository = `opuscapita/${serviceName}`;
    const tag = await getMinimalSupportedVersion(repository, semVer);

    const proxy = new EnvProxy();

    await proxy.executeCommand_L(`docker pull ${repository}:${tag}`, `pull ${repository}:${tag}`);
    //const containerId = await proxy.executeCommand_L(`docker create ${repository}:${tag}`);
    //const copyCommand = `docker cp ${containerId.trim()}:task_template.json  task_template_${serviceName}.json`;
    //log.info(copyCommand);
    //await proxy.executeCommand_L(copyCommand);
    //await proxy.executeCommand_L(`docker exec -it ${containerId} ls`);
    //await proxy.executeCommand_L(`docker rm -v ${containerId}`);

    const fetched_task_template = await proxy.executeCommand_L(`docker run --rm --entrypoint cat ${repository}:${tag}  task_template.json`);

    const taskTemplate = loadTaskTemplate(getBaseConfig({}), JSON.parse(fetched_task_template));

    log.info(taskTemplate);

    const environments = {};

    if (taskTemplate.env) {
        for (const entry of taskTemplate.env) {
            const split = entry.split('=');
            environments[split[0]] = split[1];
        }
    }

    return {
        image: `${repository}:${tag}`,
        links: ["consul"],
        labels: {SERVICE_NAME: serviceName},
        environments
    };
}

function getBaseServices() {
    return {
        consul: {
            image: "consul:latest",
            ports: ['8400:8400', '8500:8500', '8600:53/udp'],
            labels: {
                SERVICE_IGNORE: true
            },
            command: "agent -server -ui -bootstrap -client=0.0.0.0"
        },
        mysql: {
            image: 'mysql:5.6',
            ports: ["3306:3306"],
            labels: {
                SERVICE_3306_NAME: "mysql"
            },
            environment: {
                MYSQL_ROOT_PASSWORD: "${MYSQL_ROOT_PASSWORD}",
                MYSQL_DATABASE: "${MYSQL_DATABASE}"
            },
            depends_on: ["registrator"]
        },
        registrator: {
            image: "gliderlabs/registrator",
            command: "consul://consul:8500",
            volumes: [
                "/var/run/docker.sock:/tmp/docker.sock"
            ],
            depends_on: ["consul"],
            restart: "on-failure"
        }
    }
}

exec();
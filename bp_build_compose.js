'use strict';
const extend = require('extend');
const yaml = require('yaml').default;
const request = require('superagent');
const semver = require('semver');

const EpicLogger = require('./EpicLogger');
const log = new EpicLogger();

const EnvProxy = require('./EnvProxy');
const envInfo = require('./envInfo');

const libraryHelper = require('./actions/helpers/libraryHelper');

const getBaseConfig = require('./actions/getEnvVariables').getBaseConfigObject;
const loadTaskTemplate = require('./actions/filehandling/loadTaskTemplate');

const calculateEnv = require('./actions/calculateEnv');

async function exec() {

    const targetEnv = calculateEnv.getTargetEnv(process.env.CIRCLE_BRANCH);

    const config = getBaseConfig({serviceName: process.env.CIRCLE_PROJECT_REPONAME, TARGET_ENV: targetEnv});

    await getDockerHubToken(config);

    const taskTemplate = loadTaskTemplate(config);
    const s2sDependencies = await libraryHelper.fetchServiceVersionDependencies(config, taskTemplate);

    const proxy = await new EnvProxy().init(envInfo.develop);

    const serviceDependencies = extend(true, {}, s2sDependencies);

    log.info("serviceDependencies", serviceDependencies);

    const main = createMainEntry(config, taskTemplate, serviceDependencies);

    const result = {
        version: 2,
        services: {main}
    };

    for (const service in serviceDependencies) {
        result.services[service] = await getServiceBaseConfig(config, service, serviceDependencies[service]);
    }


    const baseServices = getBaseServices();
    for (const service in baseServices) {
        result.services[service] = baseServices[service];
    }

    const composeYml = yaml.stringify(result);
    require("fs").writeFileSync("duriel_compose.yml", composeYml);

    proxy.close();
}

async function getDockerHubToken(config) {

    const data = {
        username: config.get('DOCKER_PASS'),
        password: config.get('DOCKER_USER')
    }

    return await request.post("https://hub.docker.com/v2/users/login/", data)
        .set("Content-Type", "application/json")
        .then(reponse => response.body.token)
        .then(token => {
                log.info("token", token);
                config.dockerToken = token
            }
        )
        .catch(e => log.error(e))

}

async function getMinimalSupportedVersion(imageName, semVerValue) {
    return await loadImageVersions(imageName)
        .then(versions => versions.filter(it => semver.valid(it) && semver.satisfies(it, semVerValue)))
        .then(filtered => semver.sort(filtered))
        .then(sorted => sorted[0]);
}

async function loadImageVersions(imageName) {
    log.info(`fetching tags for ${imageName}`);
    return await request.get(`https://registry.hub.docker.com/v1/repositories/${imageName}/tags`)
        .set("Authorization", `JWT ${config['dockerToken']}`)
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

async function getServiceBaseConfig(config, serviceName, semVer) {
    const repository = `opuscapita/${serviceName}`;
    const tag = await getMinimalSupportedVersion(repository, semVer);

    const proxy = new EnvProxy();

    await proxy.executeCommand_L(`docker login -u ${config.get('DOCKER_USER')} -p ${config.get('DOCKER_PASS')} ; docker pull ${repository}:${tag}`, `pull ${repository}:${tag}`);
    const fetched_task_template = await proxy.executeCommand_L(`docker run --rm --entrypoint cat ${repository}:${tag} task_template.json`);

    const taskTemplate = loadTaskTemplate(getBaseConfig({}), JSON.parse(fetched_task_template), true);

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
        environments: extend(true, {}, environments, {SERVICE_NAME: serviceName}),
        depends_on: taskTemplate.serviceDependencies ? Object.keys(taskTemplate.serviceDependencies) : [],
        command: 'npm run dev'
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

exec()
    .catch(e => log.error("error while building compose file", e))
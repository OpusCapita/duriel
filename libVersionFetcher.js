'use strict';

const EnvProxy = require('./EnvProxy');
const envInfo = require('./envInfo');
const Logger = require('./EpicLogger');
const log = new Logger();
const fs = require('fs');


async function exec() {
    if (process.argv.length < 4) {
        log.error(`usage: 'node libVersionFetcher.js {user} {env} [{env}] '`);
        return;
    }
    const targetEnvs = process.argv.slice(3);
    let fetchedData = {};
    for (const targetEnv of targetEnvs) {
        const data = await fetchLibVersions(targetEnv)
            .catch(error => log.error("error during lib-fetching: ", error));
        if (data) {
            fetchedData[targetEnv] = data;
        }
    }
    const dir = `${new Date().getTime()}_libs`;
    fs.mkdirSync(dir);

    for (const env in fetchedData) {
        const filePath = `${dir}/${env}.csv`;
        log.info(` Saving information for '${env}' into file '${filePath}'... `);
        let content = "service;web-init;event-client\n" + fetchedData[env].sort().join('\n');
        fs.writeFileSync(`./${filePath}`, content);
        log.info(`Successfully exported library-infos into file: ${filePath}`);
    }

    log.info("packaging results...")
    const utilProxy = new EnvProxy();
    utilProxy.executeCommand_L(`tar -czf ${dir}.tar ${dir}/`);
    log.info(`finished packaging. file: '${dir}.tar'`)

}

async function fetchLibVersions(targetEnv) {
    const user = process.argv[2];
    const connectionData = envInfo[targetEnv];
    connectionData.admin_user = user;

    log.info(`connecting to env: ${targetEnv} with user ${user}`);
    const proxy = await new EnvProxy().init(connectionData);

    const nodes = await proxy.getNodes_E();
    const data = [];
    for (const node of nodes) {
        log.info(`Fetching data from node: ${node.hostname}`);
        const containers = await
            proxy.getContainers_N(node.hostname, true);
        for (const container of containers) {
            log.info(`\tfetching container ${container.containerId}`);
            const command = `docker exec -t ${container.containerId} cat package.json`;
            const response = await proxy.executeCommand_N(node.hostname, command);
            try {
                const parsedPackageJSON = JSON.parse(response);
                const serviceName = parsedPackageJSON.name;
                const webInitVersion = parsedPackageJSON.dependencies['@opuscapita/web-init'];
                const eventClientVersion = parsedPackageJSON.dependencies['@opuscapita/event-client'];
                data.push(`${serviceName};${webInitVersion ? webInitVersion : ""};${eventClientVersion ? eventClientVersion : ""};`);
            } catch (e) {
                // if the containers does not contain a package.json, it is not needed.
            }
        }
    }
    proxy.close();
    return data;
}

exec();

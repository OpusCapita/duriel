'use strict';

const EnvProxy = require('./EnvProxy');
const envInfo = require('./envInfo');
const Logger = require('./EpicLogger');
const log = new Logger();
const fs = require('fs');


async function exec() {
    if(process.argv.length < 4){
        log.error(`usage: 'node libVersionFetcher.js {env} {user}'`);
        return;
    }

    const targetEnv = process.argv[2];
    const user = process.argv[3];
    const connectionData = envInfo[targetEnv];
    connectionData.admin_user = user;

    log.info(`connecting to env: ${targetEnv} with user ${user}`);
    const proxy = await new EnvProxy().init(connectionData);

    const nodes = await proxy.getNodes_E();

    const data = [];

    for (const node of nodes) {
        log.info(`Fetching data from node: ${node.hostname}`);
        const containers = await proxy.getContainers_N(node.hostname, true);
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

            }
        }
    }


    await writeSummary(data);

    proxy.close();
}

async function writeSummary(data){
    log.info("Saving information into file... ")
    const fileName = `libs_${new Date().getTime()}.csv`;
    let content = "service;web-init;event-client\n" + data.join('\n');
    fs.writeFileSync(`./${fileName}`, content);
    log.info(`Successfully exported library-infos into file: ${fileName}`);
}

exec();

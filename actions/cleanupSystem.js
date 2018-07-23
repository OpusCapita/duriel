'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
module.exports = async function executeCleanup(proxy, config) {
    const env = config['TARGET_ENV'];
    log.info("Cleaning up systen after deployment on: " + env);
    const nodes = await proxy.getNodes_E();
    config['cleanups'] = config['cleanups'] ? config['cleanups'] : {};
    const entries = [];
    for (const node of nodes) {
        await proxy.executeCommand_N(node.hostname, "docker system prune -f")
            .then(response => {
                const filteredInput = response.split(/\r\n|\r|\n/g).filter(it => it.startsWith("Total reclaimed space:"))[0];
                if (filteredInput) {
                    log.info(`${node.hostname}: ${filteredInput}`);
                }
                log.debug(`cleaned node '${node.hostname}': `, response);
                const entry = {
                    node: node.hostname,
                    result: response
                };
                entries.push(entry);
            })
            .catch(error => log.warn(`could not prune node '${node.hostname}'`, error))
    }
    config['cleanups'][env] = entries;
    return {success: true};
};

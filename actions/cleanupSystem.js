'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
module.exports = executeCleanup;


async function executeCleanup(proxy, config) {
    const env = config['TARGET_ENV'];
    log.info("Cleaning up systen after deployment on: " + env);
    const nodes = await proxy.getNodes_E();
    config['cleanups'] = config['cleanups'] ? config['cleanups'] : {};
    const entries = [];
    for (const node of nodes) {
        await proxy.executeCommand_N(node.node, "docker system prune -f")
            .then(response => {
                log.debug(`cleaned node '${node.node}': `, response);
                const entry = {
                    node: node.node,
                    result: response
                };
                entries.push(entry);
            })
            .catch(error => log.warn(`could not prune node '${node.node}'`, error));
    }
    config['cleanups'][env] = entries;
}
'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
/**
 *
 * @param proxy
 * @param config
 * @returns {Promise<{success: boolean}>}
 */
module.exports = async function executeCleanup(proxy, config) {
    const env = config['TARGET_ENV'];
    log.info(`1 - Cleaning up system '${env}'`);

    log.info(`1.1 - Deleting old images from nodes.`);
    const nodes = await proxy.getNodes_E();
    config['cleanups'] = config['cleanups'] ? config['cleanups'] : {};
    const entries = [];
    for (const node of nodes) {
        await proxy.executeCommand_N(node.hostname, "docker system prune -f")
            .then(response => {
                const filteredInput = response.split(/\r\n|\r|\n/g).filter(it => it.startsWith("Total reclaimed space:"))[0];
                if (filteredInput) {
                    log.info(`1.1 - ${node.hostname}: ${filteredInput}`);
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

    log.info(`1.2 - Deleting removed secrets`);
    const deploymentSecrets = config['serviceSecrets'];
    if (deploymentSecrets && Array.isArray(deploymentSecrets.remove) && deploymentSecrets.remove.length)
        for (const entry of deploymentSecrets.remove) {
            log.info(`1.2 - deleting secret '${entry}'`);
            await proxy.removeDockerSecret(entry)
                .catch(e => log.warn(`could not delete secret '${entry}'`, e));
        }

    return {success: true};
};

'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');
const helper = require('../helpers/utilHelper');

module.exports = async function (serviceName, attempts = 5, interval = 1000) {
    const proxy = new EnvProxy();
    const result = {success: undefined, message: `Starting to check health of ${serviceName}`};
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const logBase = `${helper.padLeft(attempt, '0', 2)}/${attempts}`;
        try {
            if (attempt === attempts && !result.success) {
                result.success = false;
                result.message = `service not healthy after ${attempts} attempts`;
                throw new Error(JSON.stringify(result));
            }
            let containers = await proxy.getContainers_L();
            containers = containers.filter((service) => service.image.includes(serviceName));
            if (containers.length === 0) {
                result.success = false;
                result.message = `no container found for service ${serviceName}`;
                throw new Error(JSON.stringify(result));
            }
            log.debug("current-container-state: ", containers);
            for (let service of containers) {
                if (service.status === "healthy") {
                    log.info(`${logBase} - status is healthy`);
                    result.message = `service is healthy after ${attempt} attempts`;
                    result.success = true;
                    return result
                } else if (service.status === "unhealthy") {
                    log.error(`${logBase} - status is unhealthy`, null,  service);
                    result.message = `service is unhealthy! attempt: ${attempt}`;
                    result.success = false;
                    throw new Error(JSON.stringify(result));
                } else if (service.status === "starting") {
                    result.message = `service is still starting. attempt: ${attempt}`;
                } else {
                    result.message = `status is not in a known: '${service.status}'`
                }
            }
            log.info(`${logBase} - current-result: ${JSON.stringify(result)} waiting ${interval / 1000 }sec...`);
        } catch (error) {
            log.error("this is not good", error);
            throw error;
        }
        await helper.snooze(interval);
    }
};
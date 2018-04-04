'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');
const helper = require('../util/helper');

module.exports = async function (serviceName, attempts = 5, interval = 1000) {
    const proxy = new EnvProxy();
    return await new Promise(async (resolve, reject) => {
        const result = {success: undefined, message: `Starting to check health of ${serviceName}`};
        for (let attempt = 1; attempt <= attempts; attempt++) {
            log.info(`starting attempt ${attempt} of ${attempts}...`);
            try {
                if (attempt === attempts && !result.success) {
                    result.success = false;
                    result.message = `service not healthy after ${attempts} attempts`;
                    return reject(result);
                }
                let containers = await proxy.getContainers_L();
                containers = containers.filter((service) => service.image.includes(serviceName));
                if (containers.length === 0) {
                    result.success = false;
                    result.message = `no container found for service ${serviceName}`;
                    return reject(result);
                }
                log.debug("current-container-state: " + JSON.stringify(containers, null, 2));
                containers.forEach(service => {
                    if (service.status === "healthy") {
                        result.message = `service is healthy after ${attempt} attempts`;
                        result.success = true;
                        return resolve(result)
                    } else if (service.status === "unhealthy") {
                        log.error("service is unhealthy!");
                        result.message = `service is unhealthy! attempt: ${attempt}`;
                        result.success = false;
                        return reject(result);
                    } else if (service.status === "starting") {
                        result.message = `service is still starting. attempt: ${attempt}`;
                    } else {
                        result.message = `status is not in a known: '${service.status}'`
                    }
                    log.info(`current-result: ${JSON.stringify(result)} \n waiting ${interval}ms...`);
                });
            } catch (error) {
                return reject(error);
            }
            await helper.snooze(interval)
        }
    })
};
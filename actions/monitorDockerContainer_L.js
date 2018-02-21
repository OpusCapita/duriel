'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

module.exports = async function (serviceName, attempts = 5, interval = 1000) {
    const proxy = new EnvProxy();
    return await new Promise(async (resolve, reject) => {
        const result = {success: undefined, message: `Starting to check health of ${serviceName}`};
        let attempt = 0;
        let intervalId = setInterval(async () => {
            log.info(`starting attempt ${attempt} of ${attempts}...`);
            if (attempt === attempts && !result.success) {
                result.success = false;
                result.message = `service not healthy after ${attempts} attempts`;
                clearTimeout(intervalId);
                return reject(result);
            }
            let containers = await proxy.getContainers_L();
            containers = containers.filter((service) => service.image.includes(serviceName));
            if (containers.length === 0) {
                result.success = false;
                result.message = `no container found for service ${serviceName}`;
                clearTimeout(intervalId);
                return reject(result);
            }
            log.debug("current-container-state: " + JSON.stringify(containers, null, 2));
            containers.forEach(service => {
                if (service.status === "healthy") {
                    result.message = `service is healthy after ${attempt} attempts`;
                    result.success = true;
                    clearTimeout(intervalId);
                    return resolve(result)
                } else if (service.status === "unhealthy") {
                    log.error("service is unhealthy!");
                    result.message = `service is unhealthy! attempt: ${attempt}`;
                    result.success = false;
                    clearTimeout(intervalId);
                    return reject(result);
                } else if (service.status === "starting") {
                    result.message = `service is still starting. attempt: ${attempt}`;
                } else {
                    result.message = `status is not in a known: '${service.status}'`
                }
                log.info(`current-result: ${JSON.stringify(result)} \n waiting ${interval}ms...`);
            });
            attempt++;
        }, interval);
    })
};
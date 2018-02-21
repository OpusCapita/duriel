'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');

module.exports = function (config, proxy, isCreateMode, serviceInformation) {
    const serviceId = serviceInformation[0].ID;
    log.info(serviceId);
    for (let i = 0; i <= 200; i++) {
        if (isCreateMode) {
            // docker service ls --> replicas
        } else {
            // docker inspect --> UpdateStatus.State

        }
    }

};
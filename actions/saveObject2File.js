'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const EnvProxy = require('../EnvProxy');
const fs = require('fs');

module.exports = function (object, path, forceOverride = false) {
    log.info(`writing file ${path}`);

    if (fs.existsSync(path) && !forceOverride) {
        log.error(`will not override file '${path}'. This can be forced with the third parameter set to 'true'`)
    }
    fs.writeFileSync(path, JSON.stringify(object));
};
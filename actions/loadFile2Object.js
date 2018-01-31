'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const EnvProxy = require('../EnvProxy');
const fs = require('fs');

module.exports = function (path) {
    if (!fs.existsSync(path)) {
        throw new Error(`cannot find '${path}'`)
    }
    return JSON.parse(fs.readFileSync(path));
};
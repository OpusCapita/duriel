'use strict';

module.exports = function (config) {
    let result = `OpusCapita/andariel/${config['andariel_branch']}`;
    if(config['CIRCLE_BRANCH'] === 'master'){
        result = "OpusCapita/andariel/master";
    }
    return result;
};
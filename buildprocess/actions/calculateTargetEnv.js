'use strict';

module.exports = function (config) {
    switch (config['CIRCLE_BRANCH']) {
        case 'master':
            return "stage";
        case 'develop':
            return "develop";
        case 'test':
            return "test";
        default:
            return "none";
    }
};
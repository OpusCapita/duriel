/**
 * Module to calculate the environment of a deployment
 * @module
 */
'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

/**
 * Rules to determine the environment
 * @type {Array<object>}
 */
const environmentRules = [
    {rule: branch => ['nbp', 'develop'].includes(branch), env: "develop"},
    {rule: branch => branch.toLowerCase().startsWith("release/"), env: "stage"},
    {rule: branch => branch === 'master', env: "prod"}
];

/**
 * get the target-environment of a branch
 * @param circle_branch
 * @returns {string} e.g. 'develop'
 */
function getTargetEnv(circle_branch) {
    const matchingRules = environmentRules.filter(it => it.rule(circle_branch));
    if (matchingRules.length) {
        if(matchingRules.length > 1)
            log.warn(`found ${matchingRules.length} mathing environments for ${circle_branch}`);
        return matchingRules[0].env;
    }
}

module.exports = {
    getTargetEnv
};


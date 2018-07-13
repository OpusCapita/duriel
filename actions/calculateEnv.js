const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const environmentRules = [
    {rule: branch => branch === 'nbp', env: "dev"},
    {rule: branch => branch === 'develop', env: "dev"},
    {rule: branch => branch.toLowerCase().startsWith("release/"), env: "stage"},
    {rule: branch => branch === 'master', env: "prod"},
    {rule: branch => branch.toLowerCase().startsWith("hotfix/"), env: "prod"}
];

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


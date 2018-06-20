function getFirstEnv(circle_branch){
    switch (circle_branch) {
        case 'master':
            return "stage";
        case 'develop':
            return "develop";
        case "nbp":  // TODO: remove me
            return "develop";
        case 'test':
            return "test";
        default:
            return "none";
    }
}

function getSecondEnv(circle_branch){
    switch (circle_branch){
        case 'master':
            return "prod";
        // case "nbp":  // TODO: remove me
        //     return "stage";
        default:
            return "none";
    }
}

function isMainVersionBranch(branch){
    return branch === 'master';
}

module.exports = {
    firstTargetEnv: getFirstEnv,
    secondTargetEnv: getSecondEnv,
    isMainVersionBranch: isMainVersionBranch
};
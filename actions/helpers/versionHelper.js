/**
 * Module that offers functions to bump or compare Versions
 * @module
 */

const fs = require('fs');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const gitHelper = require('./gitHelper');
const VERSION_FILE = "VERSION";
const fileHelper = require('../filehandling/fileHandler');

const validBumpLevels = ["major", "minor", "patch"];
const versionRegex = /^[\^\~]?([0-9]+\.)([0-9]+\.)([0-9]+)(-dev-(\d)+)?(-rc-(\d)+)?(-hf-(\d)+)?$/;
const devVersionSplitter = new RegExp(/(-dev-)?(-rc-)?(-hf-)?/);

module.exports = {
    bumpVersion,
    compareVersion,
    calculateImageTag,
    mergeVersionDependencies,
    validateVersion,
    bumpProdVersion
};

/**
 * rules that check which target_env is needed for the current branch
 * @type Array<object>
 */
const tagRules = [
    {
        rule: (env) => env === 'develop',
        postFix: "dev",
        bump: async () => bumpVersion(undefined, 'minor'),
        addBuildNum: true
    },
    {
        rule: (env) => env === 'stage',
        postFix: "rc",
        bump: async () => bumpVersion(undefined, 'minor'),
        addBuildNum: true
    },
    {
        rule: (env) => env === 'prod',
        postFix: undefined,
        bump: async (config) => bumpProdVersion(config)
            .catch(e => {
                log.warn("could not bump prod version - using 'minor' bumping", e);
                return bumpVersion(undefined, "minor");
            })
    },
    {
        rule: (env, branch) => branch && branch.toLowerCase().startsWith("hotfix/"),
        postFix: "hf",
        bump: async () => bumpVersion(undefined, 'patch'),
        addBuildNum: true
    },
    {
        rule: () => true,
        postFix: "dev",
        bump: async () => bumpVersion(undefined, 'minor'),
        addBuildNum: true
    }
];

/**
 * Creates Versiontag based on the target_env, circle_branch and [optional] build-num
 * @param config {BaseConfig}
 * @returns {Promise<string>}
 */
async function calculateImageTag(config) {
    const targetEnv = config.get('TARGET_ENV');
    const branch = config['CIRCLE_BRANCH'];
    const branchRule = tagRules.filter(it => it.rule(targetEnv, branch))[0];

    const postFix = branchRule.postFix;
    const version = await branchRule.bump(config);
    const buildNum = branchRule.addBuildNum ? config.get('CIRCLE_BUILD_NUM') : undefined;
    const tagParts = [
        version.trim(),
        postFix,
        buildNum
    ]
        .filter(it => it);
    return tagParts.join("-");
}

/**
 * Bumps a Version for a production release.
 * Checks whether the master-commit came from a hotfix- or release-branch
 * @param config {BaseConfig} - used "CIRCLE_SHA1"
 * @returns {Promise<void>}
 */
async function bumpProdVersion(config) {
    const version = await gitHelper.getMainVersionTags().then(versions => versions[0]);
    const commitMerges = await gitHelper.getMerges({commit: config.get('CIRCLE_SHA1')});
    log.debug(`merges of commit ${config.get('CIRCLE_SHA1')}`, commitMerges);

    let bumpLevel = "minor";
    if (config['major_release']) {
        return await bumpVersion(version, 'major')
    }
    for (const merge of commitMerges) {
        log.debug("checking merge", merge);
        for (const parent of merge.parents) {
            const tagsOfParent = await gitHelper.getTags({commit: parent});
            if (tagsOfParent.filter(it => it.includes("-hf")).length) {
                bumpLevel = "patch";
            }
        }
    }
    return await bumpVersion(version, bumpLevel);
}

/**
 * bumps a version-string
 * e.g bumpVersion('1.0.0', 'minor') => '1.1.0'
 * @param version (e.g. 1.0.0)
 * if version is undefined, if will be the highest git-tag
 * @param bumpLevel [major, minor, patch]
 * @returns bumped version-string
 */
async function bumpVersion(version, bumpLevel = "patch") {
    if (!version) {
        version = await gitHelper.getMainVersionTags().then(versions => versions[0])
    }
    version = `${version}`.trim();
    if (!versionRegex.test(version)) {
        log.error(`${version} cannot be bumped! invalid format`);
        return;
    }
    if (!validBumpLevels.includes(bumpLevel)) {
        throw new Error(`invalid bumplevel '${bumpLevel}'`);
    }
    return createBumpedVersion(version, bumpLevel);

}

/**
 * compares the two version-strings
 * @param a: (e.g. '1.0.0')
 * @param b: (e.g. '1.0.0')
 * @returns  number
 */
function compareVersion(a, b) {
    if (!a && !b)
        return 0;
    if (!a)
        return -5;
    if (!b)
        return 5;

    const aSplit = splitIntoParts(a);
    const bSplit = splitIntoParts(b);

    if (aSplit.major !== bSplit.major) {
        return aSplit.major - bSplit.major;
    } else if (aSplit.minor !== bSplit.minor) {
        return aSplit.minor - bSplit.minor;
    } else {
        return aSplit.patch - bSplit.patch;
    }
}


/**********************************************************/
/**
 * simple function that bumps the version
 * @param version {object} (e.g. {major: 1, minor: 2, patch: 3}
 * @param bumpLevel {Array<string>} ['major', 'minor', 'patch']
 * @returns {string} bumped Version
 */
function createBumpedVersion(version, bumpLevel) {
    const vp = splitIntoParts(version);
    if (bumpLevel === "major") {
        vp.minor = vp.patch = 0;
    } else if (bumpLevel === "minor") {
        vp.patch = 0;
    }
    vp[bumpLevel] = 1 + vp[bumpLevel];

    return `${vp.major}.${vp.minor}.${vp.patch}`;
}

/**
 * splits the input-string into the parts of a version (major, minor, patch)
 * also checks the format of the input
 * @param version {object} (e.g. {major: 1, minor: 2, patch: 3})
 */
function splitIntoParts(version) {
    if (!validateVersion(version)) {
        throw new Error(`Invalid version-format '${version}'`);
    }
    const result = {};
    const mainVersionPart = version.split(".");
    result.major = parseInt(mainVersionPart[0].replace(/[\^\~]/, ""));
    result.minor = parseInt(mainVersionPart[1]);
    const patchSplit = mainVersionPart[2].split(devVersionSplitter);
    result.patch = parseInt(patchSplit[0]);
    result.deploymentNumber = parseInt(patchSplit[1]);
    return result;
}

function mergeVersionDependencies(preferHigher = true, ...dependencies) {
    log.debug("merging dependencies: ", dependencies);
    const result = {};
    for (const dependency of dependencies) {
        for (const key in dependency) {
            if (!validateVersion(dependency[key]))
                throw new Error(`${dependency[key]} is not a valid version`);
            if (result[key]) {
                const versionComparison = compareVersion(result[key], dependency[key]);
                if (preferHigher && versionComparison <= 0) {
                    result[key] = dependency[key]
                } else if (!preferHigher && versionComparison >= 0) {
                    result[key] = dependency[key];
                }
            } else {
                result[key] = dependency[key];
            }
        }
    }
    log.debug("merged dependencies: ", result);
    return result;
}

function validateVersion(version) {
    const checker = new RegExp(versionRegex);
    return version && checker.test(version);
}
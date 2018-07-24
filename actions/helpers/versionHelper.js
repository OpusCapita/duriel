const fs = require('fs');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const gitHelper = require('./gitHelper');
const VERSION_FILE = "VERSION";
const fileHelper = require('../filehandling/fileHandler');

const validBumpLevels = ["major", "minor", "patch"];


module.exports = {
    bumpVersion,
    bumpProdVersion,
    // readVersionFile,
    // bumpAndCommitVersionFile,
    calculateImageTag,
    //handleHotfixVersion
};

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

async function readVersionFile(config) {
    let versionFileContent;
    if (!fs.existsSync(VERSION_FILE)) {
        log.error('no VERSION-File found! exiting!');
        throw new Error('no VERSION-File found! exiting!');
    } else {
        versionFileContent = fs.readFileSync(VERSION_FILE, "utf8");
        return versionFileContent.replace(/(\r\n|\n|\r)/gm, "");
    }
}

async function bumpProdVersion(version, config) {
    const commitMerges = await gitHelper.getMerges({commit: config.get('CIRCLE_SHA1')})
        .then(merges => merges.map(it => it.parents));
    let bumpLevel = "minor";
    if (config['major_release']) {
        // TODO: remove var from circleci
        return await bumpVersion(version, 'major')
    }
    for (const merge of commitMerges) {
        for (const parent of merge.parents) {
            const tagsOfParent = await gitHelper.getTags({commit: parent});
            if (tagsOfParent.filter(it => it.includes("-hf")).length) {
                bumpLevel = "patch";
            }
        }
    }
    return await bumpVersion(version, bumpLevel);
}

async function bumpVersion(version, bumpLevel = "patch") {
    if (!version) {
        version = await gitHelper.getMainVersionTags().then(versions => versions[0])
    }
    version = `${version}`.trim();
    const regex = /(^[0-9]+\.)([0-9]+\.)([0-9]+)$/;
    if (!regex.test(version)) {
        log.error(`${version} cannot be bumped! invalid format`);
        return;
    }
    if (!validBumpLevels.includes(bumpLevel)) {
        throw new Error(`invalid bumplevel '${bumpLevel}'`);
    }
    return createBumpedVersion(version, bumpLevel);

}

/**********************************************************/

function createBumpedVersion(version, bumpLevel) {
    const vp = splitIntoParts(version);
    if(bumpLevel === "major"){
        vp.minor = vp.patch = 0;
    } else if (bumpLevel === "minor"){
        vp.patch = 0;
    }
    vp[bumpLevel] = 1 + vp[bumpLevel];

    return `${vp.major}.${vp.minor}.${vp.patch}`;
}

function splitIntoParts(version) {
    const result = {};
    const firstSplit = version.split("-");
    const mainVersionPart = firstSplit[0].split(".");
    result.major = parseInt(mainVersionPart[0]);
    result.minor = parseInt(mainVersionPart[1]);
    result.patch = parseInt(mainVersionPart[2]);

    if (firstSplit.length > 1) {
        log.info("version contains hotfix version");
        result.hotfix = parseInt(firstSplit[1].replace("hf", ""));
    }
    return result;
}


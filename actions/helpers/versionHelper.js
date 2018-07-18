const fs = require('fs');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const gitHelper = require('./gitHelper');
const VERSION_FILE = "VERSION";

module.exports = {
    getRawVersion: readVersionFile,
    getBumpedVersion: bumpVersion,
    bumpAndCommitVersionFile,
    calculateImageTag,
    handleHotfixVersion
};

const tagRules = [
    {rule: (env) => env === 'develop', postFix: "dev", bumpVersion: false, addBuildNum: true},
    {rule: (env) => env === 'stage', postFix: "rc", bumpVersion: false, addBuildNum: true},
    {rule: (env) => env === 'prod', postFix: undefined, bumpVersion: true},
    {
        rule: (env, branch) => branch && branch.toLowerCase().startsWith("hotfix/"),
        postFix: "hf",
        bumpVersion: false,
        addBuildNum: true
    },
    {rule: (env, branch) => true, postFix: "dev", bumpVersion: false, addBuildNum: true}
];

function calculateImageTag(config) {
    const targetEnv = config.get('TARGET_ENV');
    const branch = config['CIRCLE_BRANCH'];
    const branchRule = tagRules.filter(it => it.rule(targetEnv, branch))[0];

    const postFix = branchRule.postFix;
    const version = branchRule.bumpVersion ? bumpVersion() : readVersionFile();
    const buildNum = branchRule.addBuildNum ? config.get('CIRCLE_BUILD_NUM') : undefined;
    const tagParts = [
        version.trim(),
        postFix,
        buildNum
    ]
        .filter(it => it);
    return tagParts.join("-");
}


function readVersionFile() {
    let versionFileContent;
    if (!fs.existsSync(VERSION_FILE)) {
        log.error('no VERSION-File found! exiting!');
        throw new Error('no VERSION-File found! exiting!');
    } else {
        versionFileContent = fs.readFileSync(VERSION_FILE, "utf8");
        return versionFileContent.replace(/(\r\n|\n|\r)/gm, "");
    }
}

function bumpVersion(version, bumpLevel = "patch") {
    if (!version) {
        version = readVersionFile();
    }
    if (!version) {
        throw new Error("no version given and could not load it from file");
    }
    version = `${version}`.trim();
    const regex = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(\-hf[0-9A-Za-z-])?$/;
    if (!regex.test(version)) {
        log.error(`${version} cannot be bumped! invalid format`);
        return;
    }
    const validBumpLevels = ["major", "minor", "patch", "hotfix"];
    if (!validBumpLevels.includes(bumpLevel)) {
        log.error(`invalid bumplevel '${bumpLevel}'`);
        return;
    }
    return createBumpedVersion(version, bumpLevel);

}

async function bumpAndCommitVersionFile(version, bumpLevel = "patch", commitMessage, branch) {
    if(branch) {
        await gitHelper.checkout(branch);
    }
    const bumpedVersion = bumpVersion(version, bumpLevel);
    if (!bumpedVersion) {
        log.warn("no bumped Version could be created. Pleace check your VERSION-File");
        return;
    }
    if (!commitMessage) {
        commitMessage = `${bumpedVersion} [ci skip]`
    }
    log.info("Updating VERSION-file file locally");
    fs.writeFileSync(VERSION_FILE, bumpedVersion);
    log.info(`upload changes on VERSION-file to github`);

    try {
        await gitHelper.addFiles(VERSION_FILE);
        await gitHelper.commit(commitMessage);
        await gitHelper.push();
    } catch (e) {
        log.warn("could not bump version", e);
    }
}

/**********************************************************/

function createBumpedVersion(version, bumpLevel) {
    const vp = splitIntoParts(version);
    if (bumpLevel === "hotfix") {
        vp.hotfix = `-hf${vp.hotfix ? vp.hotfix + 1 : 1}`;
    } else {
        vp[bumpLevel] = 1 + vp[bumpLevel];
        vp.hotfix = "";
    }

    return `${vp.major}.${vp.minor}.${vp.patch}${vp.hotfix}`;
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

function handleHotfixVersion(config) {
    const branch = config['CIRCLE_BRANCH'];
    if (branch.toLowerCase().startsWith("hotfix/")) {
        log.info("Handling versioning for hotfixes");
        bumpAndCommitVersionFile(undefined, "hotfix", undefined);

    }
}

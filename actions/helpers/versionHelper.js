const fs = require('fs');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const gitHelper = require('./gitHelper');
const VERSION_FILE = "VERSION";

module.exports = {
    getRawVersion: readVersionFile,
    getDevTag: calculateDevTag,
    getBumpedVersion: bumpVersion,
    bumpAndCommitVersionFile: bumpAndCommitVersionFile
};

function calculateDevTag(config){
    const versionFileContent = readVersionFile();
    return `${versionFileContent.trim()}-${config.get('CIRCLE_BRANCH') === 'master' ? 'rc' : 'dev'}-${config.get('CIRCLE_BUILD_NUM')}`;
}


function readVersionFile(){
    let versionFileContent;
    if (!fs.existsSync(VERSION_FILE)) {
        log.error('no VERSION-File found! exiting!');
        throw new Error('no VERSION-File found! exiting!');
    } else {
        versionFileContent = fs.readFileSync(VERSION_FILE, "utf8");
        return versionFileContent.replace(/(\r\n|\n|\r)/gm, "");
    }
}

function bumpVersion(version, bumpLevel = "patch"){
    if(!version){
        version = readVersionFile();
    }
    if(!version){
        throw new Error("no version given and could not load it from file");
    }
    version = `${version}`.trim();
    const regex = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(\-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
    if (!regex.test(version)) {
        log.error(`${version} cannot be bumped! invalid format`);
        return;
    }
    const validBumpLevels = ["major", "minor", "patch"];
    if (!validBumpLevels.includes(bumpLevel)) {
        log.error(`invalid bumplevel '${bumpLevel}'`);
        return;
    }
    return createBumpedVersion(version, bumpLevel);

}

async function bumpAndCommitVersionFile (version, bumpLevel = "patch", commitMessage) {
    const bumpedVersion = bumpVersion(version, bumpLevel);
    if(!bumpedVersion){
        log.warn("no bumped Version could be created. Pleace check your VERSION-File");
        return;
    }
    if(!commitMessage){
        commitMessage = `${bumpedVersion} [ci skip]`
    }
    log.info("Updating VERSION-file file locally");
    fs.writeFileSync(VERSION_FILE, bumpedVersion);
    log.info(`upload changes on VERSION-file to github`);

    try {
        await gitHelper.addFiles(VERSION_FILE);
        await gitHelper.commit(commitMessage);
        await gitHelper.tag(bumpedVersion);
        await gitHelper.push();
        await gitHelper.pushTags();
    } catch (e) {
        log.warn("could not bump version", e);
    }
}

/**********************************************************/

function createBumpedVersion(version, bumpLevel) {
    const vp = splitIntoParts(version);
    vp[bumpLevel] = 1 + vp[bumpLevel];
    return `${vp.major}.${vp.minor}.${vp.patch}${vp.preRelease}${vp.build}`;
}

function splitIntoParts(version) {
    const result = {
        preRelease: "",
        build: ""
    };
    const firstSplit = version.split("-");
    const secondSplit = firstSplit[0].split(".");
    result.major = parseInt(secondSplit[0]);
    result.minor = parseInt(secondSplit[1]);
    result.patch = parseInt(secondSplit[2]);

    if (firstSplit.length > 1) {
        const PreReleaseAndBuild = firstSplit[1];
        const split = PreReleaseAndBuild.split("+");
        result.preRelease = `-${split[0]}`;
        if (split.length > 1) {
            result.build = `+${split[1]}`;
        }
    }
    return result;
}
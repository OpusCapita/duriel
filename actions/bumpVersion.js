'use strict';
const fs = require('fs');
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

/**
 *
 * @param version - e.g '1.0.0'
 * @param bumpLevel - 'major - minor - patch'
 * @param onlyReturn - flag to prevent
 * @returns {Promise<string>}
 */
module.exports = async function (version, bumpLevel = "patch", onlyReturn = false) {
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
    const bumpedVersion = createBumpedVersion(version, bumpLevel);
    if (onlyReturn) {
        return bumpedVersion;
    }
    log.info("Updating VERSION-file file locally");
    const proxy = new EnvProxy();
    fs.writeFileSync("./VERSION", bumpedVersion);
    log.info(`upload changes on VERSION-file to github`);
    await proxy.executeCommand_L(`git add VERSION`);
    await proxy.executeCommand_L(`git commit -m '${bumpedVersion} [ci skip]'`);
    await proxy.executeCommand_L(`git tag -a '${bumpedVersion}' -m '${bumpedVersion}'`);
    log.info("pushing to github");
    try {
        await proxy.executeCommand_L(`git push`);
    } catch (error) {
        log.error(`failed to push to github`);
    }
    await proxy.executeCommand_L(`git push --tags`);

    // git tag
    // git push


};

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
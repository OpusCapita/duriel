'use strict';
const EnvProxy = require("../../EnvProxy");
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

module.exports = {
    addFiles,
    addAll,
    tag,
    checkout,
    commit,
    push,
    pushTags,
    status,
    setCredentials,
    checkForChanges,
    getTags,
    getMainVersionTags,
    getMerges
};


async function addFiles(files) {
    log.info(`git: add '${files}'`);
    if (!Array.isArray(files)) {
        files = [files]
    }
    for (let file of files) {
        await executeCommand(`git add ${file}`);
    }
}

async function addAll() {
    log.info("git: adding all files.");
    return await executeCommand(`git add --all .`)
}

async function commit(commitMessage) {
    log.info("git: committing!");
    return await executeCommand(`git commit -m '${commitMessage}'`);
}

async function tag(tag, push) {
    log.info(`git: adding tag '${tag}'`);
    await executeCommand(`git tag -a '${tag}' -m '${tag}'`);
    if (push) {
        return pushTags();
    }
}

async function push(branch) {
    log.info('git: push');
    return await executeCommand(`git push origin ${branch}`);
}

async function pushTags() {
    log.info('git: pushing tags!');
    return await executeCommand("git push --tags")
}

async function status() {
    log.info('git: status');
    return await executeCommand("git status");
}

async function executeCommand(command) {
    const proxy = new EnvProxy();
    return await proxy.executeCommand_L(command);
}

async function checkForChanges() {
    try {
        let changedFiles = await executeCommand("git ls-files -m");
        return changedFiles.replace(/(\r\n\t|\n|\r\t)/gm, "").replace(" ", "");
    } catch (err) {
        log.error("error", err);
    }
}

async function checkout(branch) {
    try {
        log.info(`git: checkout ${branch}`);
        return await executeCommand(`git checkout ${branch}`);
    } catch (e) {
        log.error(`checkout of branch '${branch}' failed`)
    }
}

async function setCredentials(user, mail) {
    log.info(`setting git-credentials: user: ${user}, email: ${mail}`);
    await executeCommand(`git config --global user.name ${user}`);
    await executeCommand(`git config --global user.email ${mail}`);
}

/**
 * Getter
 */

async function getTags(pattern) {
    return await executeCommand(`git tag --list`)
        .then(tags => tags.split('\n')
            .filter(tag => pattern && new RegExp(pattern, "gm").test(tag)));
}

async function getMainVersionTags(){
    return await getTags(/(^[0-9]+\.)([0-9]+\.)([0-9]+)$/)
        .then(tags => tags.sort())
}

async function getMerges(){
    return await executeCommand(`git log --merges --pretty="%h% ; %P% ; %an%;%ad%;%s"`)
}
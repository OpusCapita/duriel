'use strict';
const EnvProxy = require("../../EnvProxy");
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

module.exports = {
    addFiles: addFiles,
    tag: tag,
    commit: commit,
    push: push,
    pushTags: pushTags,
    status: status,
    setCredentials: setCredentials
};


async function addFiles(files) {
    if (!Array.isArray(files)) {
        files = [files]
    }
    for (let file of files) {
        await executeCommand(`git add ${file}`);
    }
}

async function commit(commitMessage) {
    await executeCommand(`git commit -m '${commitMessage}'`);
}

async function tag(tag, push) {
    await executeCommand(`git tag -a '${tag}' -m '${tag}'`);
    if(push){
        return pushTags();
    }
}

async function push() {
    await executeCommand("git push");
}

async function pushTags() {
    await executeCommand("git push --tags")
}

async function status() {
    return await executeCommand("git status");
}

async function executeCommand(command) {
    const proxy = new EnvProxy();
    return await proxy.execureCommand_L(command);
}

async function setCredentials(user, mail){
    log.info(`setting git-credentials: user: ${user}, email: ${mail}`);
    await executeCommand(`git config --global user.name ${user}`);
    await executeCommand(`git config --global user.email ${mail}`);
}
'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');
/***
 * @param tag
 * @param commit_id
 * @returns {Promise<void>}
 */
module.exports = async function (tag, commit_id) {
    log.info(`adding tag '${tag}' to commit ${commit_id} ...`);

    if (!tag)
        log.warn("cannot tag commit - 'tag'-param missing");
    if (!commit_id)
        log.warn("cannot tag commit - 'commit_id'-param is missing");
    if (!tag || !commit_id)
        return;

    const proxy = new EnvProxy();
    await proxy.executeCommand_L(`git tag -a "${tag}" -m "${tag}"`);
    await proxy.executeCommand_L(`git push --tags`);
    log.info(`... finished adding version-tag`)
};
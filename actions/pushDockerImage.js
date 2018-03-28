'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

module.exports = async function (hub_repo, src_tag, target_tag, push_tag) {
    log.info("pushing to docker...");
    const proxy = new EnvProxy();
    log.info(`adding tag ${target_tag} to tag ${src_tag}`);
    await proxy.executeCommand_L(`docker tag ${hub_repo}:${src_tag} ${hub_repo}:${target_tag}`);
    if(push_tag) {
        log.info(`pushing tag ${push_tag}...`);
        await proxy.executeCommand_L(`docker push ${hub_repo}:${push_tag}`);
        log.info("...finished pushing docker image")
    }
};
'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');

module.exports = async function (hub_repo, tags, pushTags) {
    log.info("pushing to docker...");
    const proxy = new EnvProxy();
    const tagNames = tags.map(tag => `${hub_repo}:${tag}`);
    const pushTagNames = pushTags.map(pushTag => `${hub_repo}:${pushTag}`);
    log.info(`adding tags ${tagNames} to image`);
    await proxy.executeCommand_L(`docker tag ${tagNames.join(" ")}`);
    log.info(`pushing tags ${pushTagNames}...`);
    await proxy.executeCommand_L(`docker push ${pushTagNames.join(" ")}`);
    log.info("...finished pushing docker image")
};
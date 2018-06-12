'use strict';
const fs = require('fs');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');

async function tagImage(image, src_tag, target_tag) {
    if (src_tag && target_tag) {
        const proxy = new EnvProxy();
        log.info(`adding tag '${target_tag}' to tag '${src_tag}'`);
        await proxy.executeCommand_L(`docker tag ${image}:${src_tag} ${image}:${target_tag}`);
    }
}

async function pushImage(image, push_tag) {
    if(push_tag) {
        const proxy = new EnvProxy();
        log.info(`pushing tag '${push_tag}' to dockerhub...`);
        await proxy.executeCommand_L(`docker push ${image}:${push_tag}`);
        log.info("...finished pushing docker image")
    }
}

async function tagAndPushImage(image, src, target, push) {
    await tagImage(image, src, target);
    await pushImage(image, push);
}

/**
 * logs into dockerhub
 * if no proxy instance is give into the function:
 * creating and closing a single EnvProxy instance based on the config.
 * @param config - contains [DOCKER_USER, DOCKER_PASS] - optional: connection-info for envproxy
 * @param proxy - envProxy instance to execute command in ENV
 * @returns nothing
 */
async function onEnv (config, proxy){
    log.debug(`logging into docker with user ${config['DOCKER_USER']}`);
    let createdProxy = false;
    if(!proxy){
        log.warn(`no proxy param - trying to init a proxy`);
        proxy = await new EnvProxy().init(config);
        createdProxy = true;
    }
    console.debug(await proxy.executeCommand_L(`docker login -u ${config['DOCKER_USER']} -p ${config['DOCKER_PASS']}`).catch(err => log.warn("could not login in docker")));
    if(createdProxy){
        proxy.close();
    }
}

/**
 * executes docker login locally with the credentials inside the config object
 * @param config - used fields: {'DOCKER_USER' : '', 'DOCKER_PASS' : ''}
 * @returns {Promise<void>}
 */
async function local(config){
    log.debug(`logging into docker with user ${config['DOCKER_USER']}`);
    const proxy = new EnvProxy();
    console.debug(await proxy.executeCommand_L(`docker login -u ${config['DOCKER_USER']} -p ${config['DOCKER_PASS']}`));
}

module.exports = {
    tagImage: tagImage,
    pushImage: pushImage,
    tagAndPushImage: tagAndPushImage,
    loginLocal: local,
    loginEnv: onEnv
};
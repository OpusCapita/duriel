'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const request = require('superagent');

module.exports = async function (config, proxy) {
    const includedServices = ['kong', 'acl', 'user', 'bnp', 'onboarding', 'supplier', 'email', 'dummy'];
    if (!includedServices.includes(config['serviceName'].toLowerCase())) {
        log.info("This service needs no e2e testing");
        return;
    }
    const testStatus = await getTestStatus(config, proxy);
    if (!testStatus) {
        throw new Error("Could not get test build status!");
    }
    log.info(`BN E2E suite on ${config['CIRCLE_BRANCH']} current status = ${testStatus.status}, updating syncToken`);
    const syncToken = `build_${config['CIRCLE_BRANCH']}_${testStatus['nextTestNumber']}_${config['CIRCLE_PROJECT_REPONAME']}_${config['CIRCLE_BUILD_NUM']}`;
    await addSyncToken(config, proxy, syncToken);
    return syncToken;
};

const getTestStatus = async function (config, proxy) {
    if (!config['CIRCLE_TOKEN']) {
        log.error("CIRCLE_TOKEN not set, failing build");
    }
    const url = `https://circleci.com/api/v1.1/project/github/OpusCapita/businessnetwork/tree/${config['CIRCLE_BRANCH']}?circle-token=${config['CIRCLE_TOKEN']}&limit=1`;
    log.info(url);
    const apiResponse = await request.get(url)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .then(res => {
            return new Promise(((resolve, reject) => {
                return resolve(res.text);
            }))
        }).catch(error => {
            log.error("error while fetching testStatus", error);
            return undefined;
        });
    const parsedApiResponse = JSON.parse(apiResponse)[0];
    return {
        status: parsedApiResponse.status,
        testNumber: parsedApiResponse.build_num,
        nextTestNumber: parsedApiResponse.build_num + 1
    };
};

const addSyncToken = async function (config, proxy, tokenName) {
    log.info(`adding syncToken: '${tokenName}'`);
    const url = `https://circleci.com/api/v1.1/project/github/OpusCapita/businessnetwork/envvar?circle-token=${config['CIRCLE_TOKEN']}`;
    const data = {name: tokenName, value: ""};
    await request.post(url)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send(data)
        .then(res => new Promise(((resolve, reject) => {
                return resolve(res);
            }))
        );
};

const removeSyncToken = async function (config, proxy, syncToken) {
    const url = `https://circleci.com/api/v1.1/project/github/OpusCapita/businessnetwork/envvar/${syncToken}?circle-token=${config['CIRCLE_TOKEN']}`;
    await request.delete(url)
        .send(data)
        .then(res => new Promise(((resolve, reject) => {
                return resolve(res);
            }))
        );
};
module.exports.removeSyncToken = removeSyncToken;
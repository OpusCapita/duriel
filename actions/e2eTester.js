'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const request = require('superagent');
const helper = require('./helpers/utilHelper');

/**
 *
 * @param config
 * @param attempts
 * @param interval
 * @returns currenStatus: {
 *      status: parsedApiResponse.status,
 *      testNumber: parsedApiResponse.build_num,
 *      nextTestNumber: parsedApiResponse.build_num + 1}
 */
const waitForTest = async function (config, attempts = 240, interval = 5000) {
    for (let attempt = 1; attempt < attempts; attempt++) {
        const currentStatus = await getTestStatus(config);
        if (['running', 'queued'].includes(currentStatus.status)) {
            log.info(`current status of test #${currentStatus.testNumber}: '${currentStatus.status}', waiting ${interval / 1000} seconds...`);
            await helper.snooze(interval);
        } else if (['success', 'fixed'].includes(currentStatus.status)) {
            log.info(`current status of test #${currentStatus.testNumber}: '${currentStatus.status}'. SUCCESS!`);
            return currentStatus;
        } else {
            log.error(`current status of test #${currentStatus.testNumber}: '${currentStatus.status}'`);
            throw new Error(currentStatus);
        }

    }
};

const prepareE2ETests = async function (config, proxy) {
    log.info("Preparing E2ETesting...");
    const includedServices = ['kong', 'acl', 'user', 'bnp', 'onboarding', 'supplier', 'email', 'dummy'];
    if (!includedServices.includes(config['serviceName'].toLowerCase())) {
        log.info("This service needs no e2e testing");
        return;
    }
    if (!['develop', 'master'].includes(config['E2E_TEST_BRANCH'])) {
        log.info("this branch does not support e2e testing");
        return;
    }
    const testStatus = await getTestStatus(config, proxy);
    if (!testStatus) {
        throw new Error("Could not get test build status!");
    }
    log.info(`BN E2E suite on ${config['CIRCLE_BRANCH']} current status = ${testStatus.status}, updating syncToken`);
    const syncToken = `build_${config['CIRCLE_BRANCH']}_${testStatus['nextTestNumber']}_${config['CIRCLE_PROJECT_REPONAME']}_${config['CIRCLE_BUILD_NUM']}`;
    await addSyncToken(config, proxy, syncToken);
    return {
        syncToken: syncToken,
        testNumber: testStatus.nextTestNumber,
        testStatus: testStatus.status
    };
};

const getTestStatus = async function (config) {
    if (!config['CIRCLE_TOKEN']) {
        log.error("CIRCLE_TOKEN not set, failing build");
    }
    const url = `https://circleci.com/api/v1.1/project/github/OpusCapita/businessnetwork/tree/${config['E2E_TEST_BRANCH']}?circle-token=${config['CIRCLE_TOKEN']}&limit=1`;
    log.info(url);
    const apiResponse = await request.get(url)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .then(res => {
            return new Promise((resolve, reject) => {
                return resolve(res.body);
            })
        }).catch(error => {
            log.error("error while fetching testStatus", error);
            return undefined;
        });
    const parsedApiResponse = apiResponse[0];
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
    log.info(`removing syncToken: '${syncToken}' from CircleCi`);
    const url = `https://circleci.com/api/v1.1/project/github/OpusCapita/businessnetwork/envvar/${syncToken}?circle-token=${config['CIRCLE_TOKEN']}`;
    await request.delete(url)
        .set('Content-Type', 'application/json')
        .then(res => new Promise(((resolve, reject) => {
                log.debug('deleted syncToken successfully');
                return resolve(res);
            }))
        );
};

const triggerE2ETest = async function (config) {
    const data = {
        "build_parameters": {
            "TRIGGERED_BY": config['CIRCLE_PROJECT_REPONAME'],
            "TRIGGER_BUILD_NUM": config['CIRCLE_BUILD_NUM'],
            "TARGET_ENV": config['$targetEnv']
        }
    };

    const url = `https://circleci.com/api/v1.1/project/github/OpusCapita/andariel-end2endtests/tree/${config['CIRCLE_BRANCH']}?circle-token=${config['CIRCLE_TOKEN']}`;
    await request.post(url)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send(data)
        .then(res => new Promise(((resolve, reject) => {
                log.info("successfully triggert e2e-test");
                return resolve(res);
            }))
        );

};

module.exports = {
    waitForTest: waitForTest,
    prepareE2ETests: prepareE2ETests,
    removeSyncToken: removeSyncToken,
    triggerE2ETest: triggerE2ETest,
    getTestStatus: getTestStatus
};
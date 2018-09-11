/**
 * Module to interact and execute E2E-Tests in CircleCI
 * @module
 */
'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const request = require('superagent');
const helper = require('./helpers/utilHelper');

const bn_e2e_branch = "master";
const bn_e2e_report_file = "home/circleci/repo/reports/report.txt";

const urlBase = "https://circleci.com/api/v1.1/project/github/OpusCapita/bn-e2e-tests/";
const runningStatus = ['running', 'queued'];

const testCases = ["confirmCase", "grCase", "partialRejectionCase"]; //DANIIL sdo?
//const testCases = ["grCase"];

/**
 *
 * @param config
 * @param attempts
 * @param interval
 * @returns {object}
 *      @example {
 *      currentStatus: {
 *          status: parsedApiResponse.status,
 *          testNumber: parsedApiResponse.build_num,
 *          nextTestNumber: parsedApiResponse.build_num + 1}
 *      }
 */
const waitForTest = async function (config, attempts = 240, interval = 5000) {
    for (let attempt = 1; attempt < attempts; attempt++) {

        const currentStatus = await getTestStatus(config);
        const logBase = `${helper.padLeft(attempt, '0', 2)}/${attempts}: status of test #${currentStatus.testNumber} is '${currentStatus.status}'`;

        if (runningStatus.includes(currentStatus.status)) {

            log.info(`${logBase}, waiting ${interval / 1000} seconds...`);
            await helper.snooze(interval);

        } else {

            await helper.snooze(3000); // give circleci some time to upload

            await downloadTestArtifact(config, currentStatus.testNumber, bn_e2e_report_file)
                .then(fileContent => log.warn("e2e test report: ", fileContent))
                .catch(e => log.warn("could not fetch e2e test report: ", e));

            if (['success', 'fixed'].includes(currentStatus.status)) {

                log.info(`${logBase}. SUCCESS!`);
                return currentStatus;

            } else {

                log.error(`${logBase}, FAILURE!`, currentStatus);
                if (config['e2e_skip']) {

                    log.warn("e2e_skip set! no-one will ever know about this...");
                    return;

                } else {

                    throw new Error(currentStatus);

                }
            }
        }
    }
};

const prepareE2ETests = async function (config, proxy) {
    log.info(`Preparing E2ETesting for service '${config['serviceName']}'...`);

    const includedServices = ['kong', 'auth', 'acl', 'user', 'bnp', 'onboarding', 'supplier', 'email', 'dummy'];
    if ((!includedServices.includes(config['serviceName'].toLowerCase()) || config.fromProcessEnv('chris_little_secret'))
        && !config.fromProcessEnv('force_e2e')) {
        log.info("This service needs no e2e testing");
        return;
    }
    if (!['develop', 'stage', 'prod'].includes(config['TARGET_ENV'])) {
        log.info(`TARGET_ENV '${config['TARGET_ENV']}' does not need e2e testing`);
        return;
    }

    let testStatus = await getTestStatus(config, proxy);
    if (!testStatus) {
        throw new Error("Could not get test build status!");
    }
    if (runningStatus.includes(testStatus.status)) {
        log.info("Waiting for previous e2e test run");
        await waitForTest(config)
            .catch(e => log.warn("Previous deployment e2e-test failed!", e));
        testStatus = await getTestStatus(config);
    }

    log.info(`BN E2E suite on ${config['CIRCLE_BRANCH']} current status = ${testStatus.status}`);
    return {
        testStatus: testStatus.status,
        testNumber: testStatus.nextTestNumber,
        lastTest: testStatus.testNumber
    };
};

const getTestStatus = async function (config) {
    if (!config['CIRCLE_TOKEN']) {
        log.error("CIRCLE_TOKEN not set, failing build");
    }
    const url = `${urlBase}tree/${bn_e2e_branch}?circle-token=${config['CIRCLE_TOKEN']}&limit=5`;
    return await request.get(url)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .then(res => res.body)
        .then(apiResponse => apiResponse.filter(it => it.build_parameters && it.build_parameters.VERSION === config['TARGET_ENV']))
        .then(builds => builds[0])
        .then(build => ({
            status: build.status,
            testNumber: build.build_num,
            nextTestNumber: build.build_num + 1
        }))
        .catch(error => {
            log.error("error while fetching testStatus", error);
            return undefined;
        });
};


const triggerE2ETest = async function (config) {
    const data = {
        "build_parameters": {
            "TRIGGERED_BY": config['CIRCLE_PROJECT_REPONAME'],
            "TRIGGER_BUILD_NUM": config['CIRCLE_BUILD_NUM'],
            "TARGET_ENV": config['$targetEnv'],
            "VERSION": config['TARGET_ENV'],
            "CASES": testCases.join(',')
        }
    };
    const url = `${urlBase}tree/${bn_e2e_branch}?circle-token=${config['CIRCLE_TOKEN']}`;
    return await request.post(url)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send(data)
        .then(res => {
            log.info("successfully triggert e2e-test");
            return res;
        });
};

async function getTestArtifacts(config, buildNumber) {
    const url = `${urlBase}${buildNumber}/artifacts?circle-token=${config['CIRCLE_TOKEN']}`;
    return await request
        .get(url)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .then(response => response.body)
        .catch(e => {
            log.warn("Could not fetch e2e-artifacts", e);
            return [];
        })
}

async function downloadTestArtifact(config, buildNumber, filePath) {
    return await getTestArtifacts(config, buildNumber)
        .then(artifacts => artifacts.filter(it => it.path === filePath))
        .then(artifacts => artifacts[0])
        .then(async artifact => await request.get(`${artifact.url}?circle-token=${config['CIRCLE_TOKEN']}`))
        .then(async response => response.text)
}

module.exports = {
    waitForTest,
    prepareE2ETests,
    triggerE2ETest,
    getTestStatus,
    getTestArtifacts,
    downloadTestArtifact
};
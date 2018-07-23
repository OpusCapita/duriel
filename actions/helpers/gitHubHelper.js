'use strict';
const fs = require('fs');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const gitHelper = require('./gitHelper');
const fileHelper = require('../filehandling/fileHandler');

const request = require("superagent");


module.exports = {createPullRequest, getReviewers, removeReviewers};

async function createPullRequest(config, pr) {
    const url = `https://api.github.com/repos/OpusCapita/${config['serviceName']}/pulls`;
    return await request.post(url, pr)
        .set('Authorization', `token ${config['GIT_TOKEN']}`)
        .then(response => response.body)
        .catch(error => log.error("could not open pull-request. You have to do it manually ¯\\_(ツ)_/¯ ", error.response.body))
}

async function getReviewers(config, pullRequestId) {
    const url = `https://api.github.com/repos/OpusCapita/${config['serviceName']}/pulls/${pullRequestId}/requested_reviewers`;
    return await request.get(url)
        .set('Authorization', `token ${config['GIT_TOKEN']}`)
        .then(response => response.body)
        .catch(error => log.error("could not create pr", error.response.body))
}

async function removeReviewers(config, pullRequestId, users) {
    const url = `https://api.github.com/repos/OpusCapita/${config['serviceName']}/pulls/${pullRequestId}/requested_reviewers`;
    const requestBody = {
        "reviewers": users
    };
    return await request.delete(url, requestBody)
        .set('Authorization', `token ${config['GIT_TOKEN']}`)
        .then(response => response.body)
        .catch(error => log.error("could not create pr", error.response.body))
}

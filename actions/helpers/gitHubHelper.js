/**
 * Module that offers several functions to interact with gitHub
 * @module
 */

'use strict';
const fs = require('fs');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const gitHelper = require('./gitHelper');
const fileHelper = require('../filehandling/fileHandler');

const request = require("superagent");


module.exports = { createPullRequest, getReviewers, removeReviewers };

/**
 * Create a Pull-Request in the services repo
 * @param config {BaseConfig} used field: ['serviceName', 'GIT_TOKEN']
 * @param pr
 * @returns {Promise<T>}
 */
async function createPullRequest(config, pr) {
    const url = `https://api.github.com/repos/OpusCapita/${config['serviceName']}/pulls`;
    return await request.post(url, pr).
        set('Authorization', `token ${config['GIT_TOKEN']}`).
        then(response => response.body).
        catch(error => log.error("could not open pull-request. You have to do it manually ¯\\_(ツ)_/¯ ", error.response.body))
}

/**
 * Fetch the reviewers of a Pull-Request
 * @param config {BaseConfig}
 * @param pullRequestId
 * @returns {Promise<object>} see github docs
 */
async function getReviewers(config, pullRequestId) {
    const url = `https://api.github.com/repos/OpusCapita/${config['serviceName']}/pulls/${pullRequestId}/requested_reviewers`;
    return await request.get(url).
        set('Authorization', `token ${config['GIT_TOKEN']}`).
        then(response => response.body).
        catch(error => log.error("could not create pr", error.response.body))
}

/**
 * Remove a reviwere from a Pull-Request
 * @param config {BaseConfig}
 * @param pullRequestId
 * @param users {Array<string>} List of userNames
 * @returns {Promise<object>}
 */
async function removeReviewers(config, pullRequestId, users) {
    const url = `https://api.github.com/repos/OpusCapita/${config['serviceName']}/pulls/${pullRequestId}/requested_reviewers`;
    const requestBody = {
        "reviewers": users
    };
    return await request.delete(url, requestBody).
        set('Authorization', `token ${config['GIT_TOKEN']}`).
        then(response => response.body).
        catch(error => log.error("could not create pr", error.response.body))
}

'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const queryExecuter = require('./queryExecuter');


module.exports = async function (config, proxy) {
    return await getExistingUsers(config, proxy);

};


const getExistingUsers = async function (config, proxy) {
    const query = `SELECT 'CreatedBy=', CreatedBy FROM auth.UserAuth WHERE id = '${config['svcUserName']}'`
    log.info(`query for existing users: ${query}`);
    return await queryExecuter(config, proxy, query);

};
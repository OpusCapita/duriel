'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const queryExecuter = require('./queryExecuter');


module.exports = async function (config, proxy, checkOnly = true) {
    let injectUser = false;
    const db_init_flag = "db-Init";

    const query = `SELECT * FROM auth.UserAuth WHERE id = '${config['svcUserName']}'`;
    log.info(`query for existing users: ${query}`);
    const queryResult = await queryExecuter(config, proxy, query);

    if (queryResult[0].length === 0) {
        console.log(`${config['svcUserName']} was not found in DB`);
        injectUser = true;
    } else {
        console.info(queryResult[0]);
        let createdByDBInit = queryResult[0].filter(it => {
            return it.createdBy !== db_init_flag
        });
        log.info(createdByDBInit);
        if (createdByDBInit.length > 0) {
            console.log(`${config['svcUserName']} exists, but was not created by ${db_init_flag}, not modifying`);
        } else {
            console.log(`${config['svcUserName']} exists, created by ${db_init_flag}, updating`);
            injectUser = true;
        }
    }

    if (checkOnly) {
        console.log(injectUser ? "user needs to be injected later!" : "user already in place, no injection");
        return !injectUser;
    }

    if (injectUser) {
        log.info("Deleting old user... ");
        const deleteUserQuery = `DELETE FROM auth.UserAuth WHERE id = '${config['svcUserName']}';`;
        await queryExecuter(config, proxy, deleteUserQuery);
        log.info("... finished deleting");

        log.info("insertig new user ... ");
        const insertUserQuery = `INSERT INTO auth.UserAuth (id, password, createdBy, createdOn, changedBy, changedOn)
                                 VALUES ('${config['svcUserName']}', md5('${config['svcUserName']}'), 'build-automation', NOW(), 'build-automation', NOW());`;
        await queryExecuter(config, proxy, insertUserQuery);
        log.info("... finished inserting new user");

        return true;
    }

    return false;
};

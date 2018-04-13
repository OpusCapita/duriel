'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const queryExecuter = require('./queryExecuter');

/**
 *
 * @param config - used fields: {svcUserName, svcUserPassword}
 * @param proxy - EnvProxy instance used to connect to db
 * @param checkOnly - flag if the service user will be inserted/updated if necessary
 * @returns success<boolean>
 */
module.exports = async function (config, proxy, checkOnly = true) {
    log.info("Setting up service-user");
    let injectUser = false;
    const db_init_flag = "db-Init";

    if (!config['svcUserName']) {
        config['svcUserName'] = `svc_${config['serviceName']}`;
    }

    if(!config['svcUserPassword'] ){
        const password = await proxy.executeCommand_L(`openssl rand -base64 32`);
        log.severe(`generated password: ${password.substring(0,5)}[...]`);
        config['svcUserPassword'] = password;
    }

    const query = `SELECT * FROM auth.UserAuth WHERE id = '${config['svcUserName']}'`;
    const queryResult = await queryExecuter(config, proxy, query);

    if (queryResult[0].length === 0) {
        log.info(`${config['svcUserName']} was not found in DB`);
        injectUser = true;
    } else {
        log.info(`found ${queryResult[0].length} users`);
        let createdByDBInit = queryResult[0]
            .filter(it => it.createdBy !== db_init_flag);
        log.debug(`createdByDBInit: `, createdByDBInit);
        if (createdByDBInit.length > 0) {
            log.info(`${config['svcUserName']} exists, but was not created by ${db_init_flag}, not modifying`);
        } else {
            log.info(`${config['svcUserName']} exists, created by ${db_init_flag}, updating`);
            injectUser = true;
        }
    }
    if (checkOnly) {
        console.log(injectUser ? "user needs to be injected later!" : "user already in place, no injection");
        return injectUser;
    }

    if (injectUser) {
        log.info("Deleting old svc-user... ");
        const deleteUserQuery = `DELETE FROM auth.UserAuth WHERE id = '${config['svcUserName']}';`;
        await queryExecuter(config, proxy, deleteUserQuery);
        log.debug("... finished deleting");

        log.info("inserting new svc-user ... ");
        const insertUserQuery = `INSERT INTO auth.UserAuth (id, password, createdBy, createdOn, changedBy, changedOn)
                                 VALUES ('${config['svcUserName']}', md5('${config['svcUserPassword']}'), 'build-automation', NOW(), 'build-automation', NOW());`;
        await queryExecuter(config, proxy, insertUserQuery);
        log.info("... finished inserting new user");

        return true;
    }
    return false;
};

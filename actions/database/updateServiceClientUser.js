'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const queryExecuter = require('./queryExecuter');
const db_init_flag = "db-Init";

/**
 *
 * @param config - used fields: [svcUserName, svcUserPassword]
 * @param proxy - EnvProxy instance used to connect to db
 * @param checkOnly - flag if the service user will be inserted/updated if necessary
 * @returns success<boolean>
 */
module.exports = async function (config, proxy, checkOnly = true) {
    log.info("1 - Setting up serviceClient-user");
    let injectUser = false;
    let server = 'auth';

    if (!config['MYSQL_PW']) {
        log.warn("MySQL functions disabled as no database-password in env-vars.");
        return true;
    }

    if (!config['MYSQL_PW_AUTH']){
        server = 'mysql';
    }

    if (!config['svcUserName']) {
        config['svcUserName'] = `svc_${config['serviceName']}`;
    }

    log.info("1.1 - Checking for serviceClient-password in consul");
    config['svcUserPassword'] = await proxy.getKeyValueFromConsul(`${config['serviceName']}/service-client/password`)
        .catch(async e => {
            log.warn("1.1 - could not find service-client password in consul", e);
            const password_raw = await proxy.executeCommand_L(`openssl rand -base64 32`);
            const password = password_raw.replace(/(\r\n|\n|\r)/gm, "");
            log.severe(`1.1 - generated password: ${password.substring(0, 5)}[...]`);
            injectUser = true;
            return password;
        });

    log.info("1.2 - Checking for serviceUser inside the database");
    const query = `SELECT * FROM auth.UserAuth WHERE id = '${config['svcUserName']}'`;
    const queryResult = await queryExecuter(config, proxy, query, server);

    if (queryResult[0].length === 0) {
        log.info(`1.2 - ${config['svcUserName']} was not found in the database`);
        injectUser = true;
    } else {
        log.debug(`1.2 - found ${queryResult[0].length} users`);
        let createdByDBInit = queryResult[0]
            .filter(it => it.createdBy !== db_init_flag);
        log.debug(`createdByDBInit: `, createdByDBInit);
        if (createdByDBInit.length > 0) {
            log.debug(`1.2 - ${config['svcUserName']} exists, but was not created by ${db_init_flag}, not modifying`);
        } else {
            log.debug(`1.2 - ${config['svcUserName']} exists, created by ${db_init_flag}, updating`);
            injectUser = true;
        }
    }
    if (checkOnly) {
        console.log(injectUser ? "user needs to be injected later!" : "user already in place, no injection");
        return injectUser;
    }

    if (injectUser) {
        log.info("2.0 - Injecting new serviceUser to database and consul");

        log.info("2.1 - Deleting old svc-user... ");
        const deleteUserQuery = `DELETE FROM auth.UserAuth WHERE id = '${config['svcUserName']}';`;
        await queryExecuter(config, proxy, deleteUserQuery, server);
        log.debug("2.1 - ... finished deleting");

        log.info("2.2 - inserting new svc-user ... ");
        const insertUserQuery = `INSERT INTO auth.UserAuth (id, password, createdBy, createdOn, changedBy, changedOn)
                                 VALUES ('${config['svcUserName']}', md5('${config['svcUserPassword']}'), 'build-automation', NOW(), 'build-automation', NOW());`;
        await queryExecuter(config, proxy, insertUserQuery, server);
        log.debug("2.2 - ... finished inserting new user");

        log.info("3.0 - Adding service-client credentials to consul");
        await proxy.addKeyValueToConsul(`${config['serviceName']}/service-client/username`, config['svcUserName']);
        await proxy.addKeyValueToConsul(`${config['serviceName']}/service-client/password`, config['svcUserPassword']);
        await proxy.addKeyValueToConsul(`${config['serviceName']}/service-client/client-secret`, config.get(`SECRET_${config['TARGET_ENV']}_OIDCCLIENT`));
        await proxy.addKeyValueToConsul(`${config['serviceName']}/service-client/client-key`, 'oidcCLIENT');
        log.debug("3.0 ... finished adding credentials to consul");

        return true;
    }
    return false;
};

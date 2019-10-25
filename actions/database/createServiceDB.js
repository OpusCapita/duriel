'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const fs = require('fs');
const queryExecuter = require('./queryExecuter');

const loadTaskTemplate = require('../filehandling/loadTaskTemplate');

/**
 *
 * @param config - used fields: [serviceName, TARGET_ENV]
 * @param proxy - EnvProxy instance
 * @param forceUserCreate - flag to force password update of database-user
 * @returns -
 */
module.exports = async function (config, proxy, forceUserCreate = false) {
    if(!config['MYSQL_PW']) {
        log.warn("MySQL functions disabled as no database-password in env-vars.");
        return
    }

    const task_template = loadTaskTemplate(config);
    const db_init_settings = task_template["oc-db-init"];
    if (!db_init_settings) {
        log.info(`skipping db handling - no setting inside task_template.json`);
        return;
    }
    const populate_test_data = db_init_settings['populate-test-data'];
    //log.info("Handling Service Database");
    //log.info("1 getting table schemas");
    //const schemaQuery = `SELECT schema_name as schemaName FROM information_schema.schemata WHERE schema_name = '${config['serviceName']}';`;
    //const schemaQueryResult = await queryExecuter(config, proxy, schemaQuery);
    //const foundServiceTable = schemaQueryResult[0].length > 0;

    log.info("1 getting service-db-users");
    const userQuery = `SELECT COUNT(*) as count FROM mysql.user WHERE User = '${config['serviceName']}';`;
    const userQueryResult = await queryExecuter(config, proxy, userQuery);
    const foundServiceUser = userQueryResult[0][0].count > 0;

    log.info(`2 result: foundServiceUser: ${foundServiceUser}`);


    //if (!foundServiceTable) {
    log.info("3.1 creating service-database");
    const createDBQuery = `CREATE DATABASE IF NOT EXISTS \`${config['serviceName']}\`;`;
    await queryExecuter(config, proxy, createDBQuery);
    log.info("3.1 successfully created service-database in case it doesn't exist");
    //}

    log.info("3.2 getting database password");
    let db_password = null;
    let injectIntoConsul = false;
    try {
        db_password = await proxy.getKeyValueFromConsul(`${config['serviceName']}/db-init/password`);
    } catch (error) {
        log.warn("error while getting service-password from consul: ", error);
    }
    let username_domain = '';
    try {
        let mysql_service = await proxy.queryConsul('v1/catalog/service/' + config['MYSQL_SERVICE']).then(data => {
            log.debug(config['MYSQL_SERVICE'] + ' looked up: ' + data[0].Address);
            return Promise.resolve([data[0].Address, data[0]['NodeMeta']['external-node']]);
        })
        .catch(error => {
            log.error(`error looking up '${config['MYSQL_SERVICE']}'`, error);
            throw error;
        });
        if(mysql_service[1]=="true"){
            username_domain="@"+mysql_service[0].split(".")[0];
        }
    } catch (error) {
        log.warn("error while getting service-host from consul: ", error);
    }
    if (!db_password) {
        log.info("3.2 no database-password was stored in consul. creating a new one!");
        db_password = await proxy.executeCommand_L(`openssl rand -base64 32`);
        db_password = db_password.replace(/(\r\n|\n|\r)/gm, "");
        injectIntoConsul = true;
    }

    if (!foundServiceUser) {
        log.info("3.3 creating service-database-user");
        const createUserQuery = `CREATE USER '${config['serviceName']}'@'%' IDENTIFIED BY '${db_password}';
                                 GRANT ALL PRIVILEGES ON \`${config['serviceName']}\`.* TO '${config['serviceName']}'@'%';
                                 FLUSH PRIVILEGES;`;
        await queryExecuter.executeMultiLineQuery(config, proxy, createUserQuery);
    }

    if (forceUserCreate) {
        log.info("3.4 forcing service-database-user update");
        const userPwQuery = `select count(*) as count from mysql.user where user = '${config['serviceName']}' and password('${db_password}') = authentication_string;`;
        const userPwQueryResult = await queryExecuter(config, proxy, userPwQuery);
        if (0 === userPwQueryResult[0][0].count) {
            log.info("3.4 updating user in db.");
            const updateUserQuery = `UPDATE mysql.user SET authentication_string = PASSWORD('${db_password}') WHERE USER ='${config['serviceName']}';
                                     FLUSH PRIVILEGES;`;
            await queryExecuter.executeMultiLineQuery(config, proxy, updateUserQuery);
        } else {
            log.info("3.4 no need to update user. skipping");
        }
        log.info("3.4 successfully updated service-database-user");
    }

    if (injectIntoConsul) {
        log.info("3.5 injecting data into consul");
        log.debug(await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/password`, db_password));
        log.debug(await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/user`, config['serviceName']+username_domain));
        log.debug(await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/database`, config['serviceName']));
        log.debug(await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/populate-test-data`, populate_test_data));
        log.info("3.5 keys injected.")
    }

};
























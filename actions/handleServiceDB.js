'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const queryExecuter = require('./queryExecuter');

module.exports = async function (config, proxy, forceUserCreate = false) {
    const db_init_flag = "oc-db-init";

    if (!fs.existsSync('./task_template_mapped.json')) {
        throw new Error("could not find task_template.json");
    }
    const taskTemplateContent = fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'});
    const taskTemplate = JSON.parse(JSON.parse(taskTemplateContent));   // TODO: wtf? like... ??!
    log.info("successfully loaded task_template_json");

    let db_init_settings;
    if (taskTemplate[`${config['TARGET_ENV']}`]) {
        db_init_settings = taskTemplate[`${config['TARGET_ENV'][db_init_flag]}`];
    } else {
        log.debug("no env-specific settings inside task_template.");
    }

    if (!db_init_settings) {
        if (taskTemplate['default']) {
            db_init_settings = taskTemplate['default'][db_init_flag]
        } else {
            log.debug("no default settings inside task_template.")
        }
    }
    if (!db_init_settings) {
        log.info(`skipping db handling - no setting inside task_template.json`);
        return;
    }

    const populate_test_data = db_init_settings['populate-test-data'];

    log.info("gathering database-information: ");
    log.info("1 getting table schemas");
    const schemaQuery = `SELECT schema_name as schemaName FROM information_schema.schemata WHERE schema_name = '${config['serviceName']}';`;
    const schemaQueryResult = await queryExecuter(config, proxy, schemaQuery);
    console.log(schemaQueryResult);
    const foundServiceTable = schemaQueryResult[0].filter(row => row.schemaName === config['serviceName']).length > 0;

    log.info("2 getting service-db-users");
    const userQuery = `SELECT COUNT(*) as count FROM mysql.user WHERE User = '${config['serviceName']}';`;
    const userQueryResult = await queryExecuter(config, proxy, userQuery);
    const foundServiceUser = userQueryResult[0][0].count > 0;

    log.info(`3 result: foundServiceTable: ${foundServiceTable}, foundServiceUser: ${foundServiceUser}`);

    log.info("4.1 creating service-database");
    if (!foundServiceTable) {
        const createDBQuery = `SET sql_mode = 'ANSI_QUOTES';
                           CREATE DATABASE "${config['serviceName']}";`;
        await queryExecuter(config, proxy, createDBQuery);
    } else {
        log.info("4.1 skipping.")
    }
    log.info("4.1 successfully created service-database");

    log.info("4.2 getting database password");
    let db_password = null;
    let injectIntoConsul = false;
    try {
        const consulPasswords = await proxy.queryConsul(`/v1/kv/${config['serviceName']}/db-init/password`);
        const consulPassword = consulPasswords[0];
        db_password = consulPassword['Value'];
    } catch (error) {
        // No Value -> 404 -> Promise.reject -> Error
    }
    if (!db_password) {
        log.info("4.2 no database-password was stored in consul. creating a new one!");
        db_password = await proxy.executeCommand_L(`openssl rand -base64 32`);
        injectIntoConsul = true;
    }
    log.info("4.2 finished getting database password");

    log.info("4.3 creating service-database-user");
    if (!foundServiceUser) {

        const userCreateQuery = `SET sql_mode = 'ANSI_QUOTES';
                                 CREATE USER '${config['serviceName']}@'%' IDENTIFIED BY '${db_password}';
                                 GRANT ALL PRIVILEGES ON "${config['serviceName']}".* TO '${config['serviceName']}'@'%';
                                 FLUSH PRIVILEGES;`;
        await queryExecuter(config, proxy, userCreateQuery);
    } else {
        log.info("4.3 skipping.")
    }
    log.info("4.3 successfully created service-database-user");

    log.info("4.4 forcing service-database-user update");
    if (forceUserCreate) {
        const userPwQuery = `select count(*) as count from mysql.user where user = '${config['serviceName']}' and password('${db_password}') = authentication_string;`;
        const userPwQueryResult = await queryExecuter(config, proxy, userPwQuery);
        if (0 === userPwQueryResult[0][0].count && false) {
            log.info("4.4 updating user in db.");
            const updateUserQuery = `UPDATE mysql.user SET authentication_string = PASSWORD('${db_password}') WHERE USER='${config['serviceName']}';FLUSH PRIVILEGES;`;
            await queryExecuter(config, proxy, updateUserQuery);
        } else {
            log.info("4.4 no need to update user. skipping");
        }
    }
    log.info("4.4 successfully updated service-database-user");

    log.info("4.5 injecting data into consul");
    if (injectIntoConsul || true) {
        await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/password`, db_password);
        await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/user`, config['serviceName']);
        await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/database`, config['serviceName']);
        await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/populate-test-data2`, populate_test_data + "kevin");
        log.info("4.5 keys injected.")
    } else {
        log.info("4.5 skipping");
    }
    log.info("4.5 finished injecting data into consul");

};


























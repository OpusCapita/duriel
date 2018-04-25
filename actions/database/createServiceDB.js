'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const fs = require('fs');
const queryExecuter = require('./queryExecuter');

/**
 *
 * @param config - used fields: [serviceName, TARGET_ENV]
 * @param proxy - EnvProxy instance
 * @param forceUserCreate - flag to force password update of database-user
 * @returns -
 */
module.exports = async function (config, proxy, forceUserCreate = false) {
    const task_template = loadTaskTemplate(config);
    const db_init_settings = getTaskTemplateSettings(config, task_template);
    if (!db_init_settings) {
        log.info(`skipping db handling - no setting inside task_template.json`);
        return;
    }
    const populate_test_data = db_init_settings['populate-test-data'];
    log.info("Handling Service Database");
    log.info("1 getting table schemas");
    const schemaQuery = `SELECT schema_name as schemaName FROM information_schema.schemata WHERE schema_name = '${config['serviceName']}';`;
    const schemaQueryResult = await queryExecuter(config, proxy, schemaQuery);
    const foundServiceTable = schemaQueryResult[0].filter(row => row.schemaName === config['serviceName']).length > 0;

    log.info("2 getting service-db-users");
    const userQuery = `SELECT COUNT(*) as count FROM mysql.user WHERE User = '${config['serviceName']}';`;
    const userQueryResult = await queryExecuter(config, proxy, userQuery);
    const foundServiceUser = userQueryResult[0][0].count > 0;

    log.info(`3 result: foundServiceTable: ${foundServiceTable}, foundServiceUser: ${foundServiceUser}`);


    if (!foundServiceTable) {
        log.info("4.1 creating service-database");
        const createDBQuery = `CREATE DATABASE \`${config['serviceName']}\`;`;
        await queryExecuter(config, proxy, createDBQuery);
        log.info("4.1 successfully created service-database");
    }

    log.info("4.2 getting database password");
    let db_password = null;
    let injectIntoConsul = false;
    try {
        db_password = await proxy.getKeyValue(`${config['serviceName']}/db-init/password`);
    } catch (error) {
        log.error("error while getting service-password from consul: ", error);
    }
    if (!db_password) {
        log.info("4.2 no database-password was stored in consul. creating a new one!");
        db_password = await proxy.executeCommand_L(`openssl rand -base64 32`);
        injectIntoConsul = true;
    }

    if (!foundServiceUser) {
        log.info("4.3 creating service-database-user");
        const createUserQuery = `CREATE USER '${config['serviceName']}'@'%' IDENTIFIED BY '${db_password}';
                                 GRANT ALL PRIVILEGES ON \`${config['serviceName']}\`.* TO '${config['serviceName']}'@'%';
                                 FLUSH PRIVILEGES;`;
        await queryExecuter.executeMultiLineQuery(config, proxy, createUserQuery);
    }

    if (forceUserCreate) {
        log.info("4.4 forcing service-database-user update");
        const userPwQuery = `select count(*) as count from mysql.user where user = '${config['serviceName']}' and password('${db_password}') = authentication_string;`;
        const userPwQueryResult = await queryExecuter(config, proxy, userPwQuery);
        if (0 === userPwQueryResult[0][0].count) {
            log.info("4.4 updating user in db.");
            const updateUserQuery = `UPDATE mysql.user SET authentication_string = PASSWORD('${db_password}') WHERE USER ='${config['serviceName']}';
                                     FLUSH PRIVILEGES;`;
            await queryExecuter.executeMultiLineQuery(config, proxy, updateUserQuery);
        } else {
            log.info("4.4 no need to update user. skipping");
        }
        log.info("4.4 successfully updated service-database-user");
    }

    if (injectIntoConsul) {
        log.info("4.5 injecting data into consul");
        log.debug(await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/password`, db_password));
        log.debug(await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/user`, config['serviceName']));
        log.debug(await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/database`, config['serviceName']));
        log.debug(await proxy.addKeyValueToConsul(`${config['serviceName']}/db-init/populate-test-data`, populate_test_data));
        log.info("4.5 keys injected.")
    }

};

function loadTaskTemplate() {
    if (!fs.existsSync('./task_template_mapped.json')) {
        throw new Error("could not find task_template.json");
    }
    const taskTemplate = JSON.parse(fs.readFileSync('./task_template_mapped.json', {encoding: 'utf8'}));   // TODO: wtf? like... ??!
    log.info("successfully loaded task_template_json");
    return taskTemplate;
}

function getTaskTemplateSettings(config, taskTemplate) {
    const db_init_flag = "oc-db-init";
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
    return db_init_settings;
}
























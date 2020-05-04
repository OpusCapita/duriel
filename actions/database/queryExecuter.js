'use strict';

const Logger = require('../../EpicLogger');
const log = new Logger();
const mysql = require('mysql2/promise');

module.exports = function (config, proxy, query) {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers['mysql'].port,
        user: 'root',
        password: config['MYSQL_PW']
    }, query);

};

module.exports.executeMultiLineQuery = function (config, proxy, query) {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers['mysql'].port,
        user: 'root',
        password: config['MYSQL_PW'],
        multipleStatements: true
    }, query);
};

async function executeQuery(params, query) {
    let result;

    log.debug('Executing query: ', query);

    const conn = await mysql.createConnection(params);
    result = await conn.query(query);
    await conn.close();

    return result;
}


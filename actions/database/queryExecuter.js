'use strict';

const Logger = require('../../EpicLogger');
const log = new Logger();
const mysql = require('mysql2/promise');

module.exports = function (config, proxy, query, server='mysql') {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers['mysql'+serverToService(server).toLowerCase()].port,
        user: config['MYSQL_USER'+serverToService(server)],
        password: config['MYSQL_PW'+serverToService(server)]
    }, query);

};

module.exports.executeMultiLineQuery = function (config, proxy, query, server='mysql') {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers['mysql'+serverToService(server).toLowerCase()].port,
        user: config['MYSQL_USER'+serverToService(server)],
        password: config['MYSQL_PW'+serverToService(server)],
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


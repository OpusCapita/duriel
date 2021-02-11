'use strict';

const Logger = require('../../EpicLogger');
const log = new Logger();
const mysql = require('mysql2/promise');

module.exports = function (config, proxy, query, server = 'mysql') {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers['mysql' + serverToService(server).toLowerCase()].port,
        user: config['MYSQL_USER' + serverToService(server)],
        password: config['MYSQL_PW' + serverToService(server)]
    }, query);

};

module.exports.executeMultiLineQuery = function (config, proxy, query, server = 'mysql') {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers['mysql' + serverToService(server).toLowerCase()].port,
        user: config['MYSQL_USER' + serverToService(server)],
        password: config['MYSQL_PW' + serverToService(server)],
        multipleStatements: true
    }, query);
};

async function executeQuery(params, query) {
    let result;

    log.debug("executing query: ", query);
    return mysql.createConnection(params)
        .then(async connection => {
            result = await connection.query(query);
            connection.close();
            return result;
        });
}

function serverToService(server) {
    if (server == 'mysql') {
        return '';
    }
    return '_' + server.toUpperCase();
}

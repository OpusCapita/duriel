'use strict';
const Logger = require('../../EpicLogger');
const log = new Logger();
const mysql = require('mysql2/promise');

module.exports = function (config, proxy, query, server='mysql') {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers[server].port,
        user: 'root',
        password: config['MYSQL_PW'] //TODO PASSWORD NEEDS TO REFLECT SERVER
    }, query);

};

module.exports.executeMultiLineQuery = function (config, proxy, query, server='mysql') {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers[server].port,
        user: 'root',
        password: config['MYSQL_PW'],
        multipleStatements: true
    }, query);
};

function executeQuery(params, query) {
    let result;
    log.debug("executing query: ", query);
    return mysql.createConnection(params)
        .then(async connection => {
            result = await connection.query(query);
            connection.close();
            return result;
        });
}


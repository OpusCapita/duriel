'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const mysql = require('mysql2/promise');

module.exports = function (config, proxy, query) {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers['mysql'].port,
        user: 'root',
        password: 'notSecureP455w0rd'   //TODO: make depending on config
    }, query);

};

module.exports.executeMultiLineQuery = function (config, proxy, query) {
    return executeQuery({
        host: 'localhost',
        port: proxy.proxyServers['mysql'].port,
        user: 'root',
        password: 'notSecureP455w0rd', //TODO: make depending on config
        multipleStatements: true
    }, query);
};

function executeQuery(params, query) {
    let result;
    return mysql.createConnection(params)
        .then(async connection => {
            result = await connection.query(query);
            connection.close();
            return result;
        });
}


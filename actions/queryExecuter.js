'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
const mysql = require('mysql2/promise');

module.exports = function (proxy, query) {
    let result;
    return mysql.createConnection({
        host: 'localhost',
        port: proxy.proxyServers['mysql'].port,
        user: 'root',
        password: 'notSecureP455w0rd'
    }).then(async connection => {
        result = await connection.query(query);
        connection.close();
        return result;
    })
};

module.exports.flushPrivileges = function (proxy) {
    return module.exports(proxy, "flush privileges");
};
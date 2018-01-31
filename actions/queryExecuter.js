'use strict';
const Logger = require('../EpicLogger');
const log = new Logger();
const fs = require('fs');
let mysql = require('mysql2/promise');

module.exports = function (config, proxy, query) {
    let result;
    return mysql.createConnection({
        host: 'localhost',
        port: proxy.proxyServers['mysql'].port,
        user: 'root',
        password: 'notSecureP455w0rd'
    }).then(async connection => {
        result = await connection.query(query);
        connection.close();                     // you have to close or only one query will be available :(
        return result;
    })
};
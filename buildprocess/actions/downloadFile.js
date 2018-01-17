'use strict';
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../../EnvProxy');
const https = require('https');
const fs = require('fs');


module.exports = async function (url, targetFile) {
    return new Promise((resolve, reject) => {

        const file = fs.createWriteStream(targetFile);
        const req = https.request(url, (res) => {
            console.log('statusCode:', res.statusCode);
            console.log('headers:', res.headers);

            res.pipe(file);
            res.on('finish', () => {
                file.close();
                return resolve();
            });
        });

        req.on('error', (e) => {
            console.error(e);
            fs.unlink(targetFile);
            return reject(e);
        });
        req.end();
    });
};
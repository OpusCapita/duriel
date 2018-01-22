'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const https = require('https');
const fs = require('fs');


module.exports = async function (url, targetFile) {
    return new Promise((resolve, reject) => {

        const file = fs.createWriteStream(targetFile);
        const req = https.request(url, (res) => {
            log.debug('statusCode:', res.statusCode);
            log.debug('headers:', res.headers);

            res.pipe(file);
            res.on('finish', () => {
                file.close();
                log.info("finished downloading file");
                return resolve();
            });
        });

        req.on('error', (e) => {
            log.error("error while downloading file", e);
            fs.unlink(targetFile);
            return reject(e);
        });
        req.end();
    });
};
'use strict';
const request = require('superagent');
const fs = require('fs');

module.exports = async function (url, file, config) {

    await request.get(url)
        .set('Authorization', `token ${config['GIT_TOKEN']}`)
        // .pipe(fs.createWriteStream(file));   // pipe is async and does not return a promise
        .then(res => {
            fs.writeFile(file, res.text, function (error) {
                return new Promise(((resolve, reject) => {
                    if (error) {
                        return reject(error);
                    } else {
                        return resolve();
                    }
                }))
            })
        })
};
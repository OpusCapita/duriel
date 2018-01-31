'use strict';
const request = require('superagent');
const fs = require('fs');

module.exports = function (url, file, config) {
    return request.get(url)
        .set('Authorization', `token ${config['GIT_TOKEN']}`)
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
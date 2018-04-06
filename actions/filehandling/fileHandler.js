'use strict';
const request = require('superagent');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const variableInjector = require('./injectVariables');
const fs = require('fs');

async function downloadURL2File(url, targetFile) {
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
}

async function loadTaskTemplate(config) {
    if (!fs.existsSync('./task_template.json')) {
        throw new Error("could not find task_template.json");
    }
    const taskTemplate = fs.readFileSync('./task_template.json', {encoding: 'utf8'});
    log.info("loaded task_template successfully.");

    log.info("Injecting values into task_template.json");
    const injectorResult = variableInjector(JSON.stringify(taskTemplate), config);
    log.debug("Trying to parse edited data back to JSON");
    JSON.parse(injectorResult);
    log.info("Writing mapped task_template.json");
    fs.writeFileSync("./task_template_mapped.json", JSON.parse(injectorResult), {encoding: 'utf8'});
    return injectorResult;
}

function loadFileFromPrivateGit(url, file, config) {
    return request.get(url)
        .set('Authorization', `token ${config['GIT_TOKEN']}`)
        .then(res => {
            fs.writeFile(file, res.text, function (error) {
                return new Promise(((resolve, reject) => {
                    if (error) {
                        return reject(error);
                    } else {
                        return resolve(res.text);
                    }
                }))
            })
        })
}

function saveObject2File(object, path, forceOverride = false) {
    log.info(`writing file ${path}`);

    if (fs.existsSync(path) && !forceOverride) {
        log.error(`will not override file '${path}'. This can be forced with the third parameter set to 'true'`)
    }
    fs.writeFileSync(path, JSON.stringify(object));
}

function loadFile2Object(path) {
    if (!fs.existsSync(path)) {
        throw new Error(`cannot find '${path}'`)
    }
    return JSON.parse(fs.readFileSync(path));
}

module.exports = {
    loadUrl2file: downloadURL2File,
    loadTaskTemplate: loadTaskTemplate,
    loadPrivateGit2File: loadFileFromPrivateGit,
    saveObject2File: saveObject2File,
    loadFile2Object: loadFile2Object
};
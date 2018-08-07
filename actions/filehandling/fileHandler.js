/**
 * HelperModule that offers functions to handle with files.
 * @module
 */
'use strict';
const request = require('superagent');
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();
const variableInjector = require('./injectVariables');
const fs = require('fs');
const pathJs = require('path');

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
        log.error("no task_template");
        throw new Error("could not find task_template.json");
    }
    const taskTemplate = fs.readFileSync('./task_template.json', {encoding: 'utf8'});
    log.info("loaded task_template successfully.");

    log.info("Injecting values into task_template.json");
    const injectorResult = variableInjector(JSON.stringify(taskTemplate), config);
    log.debug("Trying to parse edited data back to JSON");
    JSON.parse(injectorResult);
    log.debug("Writing mapped task_template.json");
    fs.writeFileSync("./task_template_mapped.json", JSON.parse(injectorResult), {encoding: 'utf8'});
    return injectorResult;
}

function loadFileFromPrivateGit(url, config) {
    return request.get(url)
        .set('Authorization', `token ${config['GIT_TOKEN']}`)
        .then(res => res.text);
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

/**
 *
 * @param path
 * @param regex
 * @returns {Array}
 */
function getFilesInDir(path, regex) {
    path = pathJs.resolve(path);
    const fileFilter = new RegExp(regex);
    let result = [];
    const current = fs.readdirSync(path);
    current.forEach(file => {
        const entry = pathJs.join(path, file);
        const stat = fs.statSync(entry);
        if (stat.isDirectory()) {
            result = result.concat(getFilesInDir(entry));
        } else {
            if (fileFilter.test(entry))
                result.push(entry);
        }
    });
    return result.filter(it => fileFilter.test(it));
}

/**
 * node.js version of mkdir -p
 * @param path
 */
function mkdirp(path) {
    let current = "";
    path = pathJs.resolve(path);
    const subPaths = pathJs.dirname(path).split(pathJs.sep);

    for (const subPath of subPaths) {
        current = `${current}${subPath}${pathJs.sep}`;

        if (!fs.existsSync(current))
            fs.mkdirSync(current);
        else if (fs.lstatSync(current).isFile())
            throw new Error(`path '${current}' is a File.`);
    }
}

module.exports = {
    downloadURL2File,
    loadTaskTemplate,
    loadFileFromPrivateGit,
    saveObject2File,
    loadFile2Object,
    getFilesInDir,
    mkdirp
};

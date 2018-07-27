'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const fileHandler = require('./filehandling/fileHandler');
const gitHelper = require('./helpers/gitHelper');

const fileHelper = require('./filehandling/fileHandler');
const fs = require("fs");

const raml2md = require("raml-to-markdown");
const jsdoc2md = require("jsdoc-to-markdown");
const seq2md = require("sequelize-to-markdown");
const libraryHelper = require('./helpers/libaryHelper');

const wikiDirs = ["./wiki/rest-doc/dummy.s", "./wiki/domain-doc/dummy.d", "./wiki/api-doc/dummy.f"];
const sourceCodeDir = "src/server";

module.exports = async function (compose_base, config, commit = false) {
    const proxy = new EnvProxy();
    log.info("build docs");
    let packageJson;
    try {
        log.info("loading package.json");
        packageJson = await fileHandler.loadFile2Object("./package.json");
    } catch (error) {
        log.error("could not load package.json");
        return;
    }

    if (packageJson['scripts'] && packageJson['scripts']['doc']) {

        await proxy.executeCommand_L("npm install sequelize@3.30.4");

        await proxy.executeCommand_L("rm -Rf wiki");
        try {
            await proxy.executeCommand_L(`git clone https://github.com/OpusCapita/${config['serviceName']}.wiki.git wiki`);
        } catch (error) {
            log.warn("error during clong wiki", error);
            return;
        }
        await proxy.changePermission_L("777 -R", "wiki", true);
        try {
            // await proxy.executeCommand_L(`${compose_base} run main npm run doc`);
            await createDocs(commit)
        } catch (error) {
            log.error("error during creating documentation", error);
            return;
        }
        await proxy.changeCommandDir_L("wiki");
        if (commit) {
            log.info("committing and pushing changes of documentation");
            const changedFiles = await gitHelper.checkForChanges();
            if (!changedFiles || changedFiles === "") {
                log.info("no files changed!");
            } else {
                log.info("changed files: ", changedFiles);
                await gitHelper.setCredentials(config['GIT_USER'], config['GIT_EMAIL']);
                await gitHelper.addAll();
                await gitHelper.commit('updated documentation. [ci skip]');
                await gitHelper.push('master');
            }
        } else {
            const gitStatus = await gitHelper.status();
            log.info("git would commit doc changes:", gitStatus);
        }
        await proxy.changeCommandDir_L("..");
    }
};

/**
 * Creates rest-, domain- and js-docs
 * files will be written into wiki/
 */
async function createDocs(failOnError = false) {

    log.info("Creating directories for wiki ");
    wikiDirs.forEach(dir => fileHelper.mkdirp(dir));
    log.debug("all directories created!");

    try {
        log.info("Creating REST-doc based on RAML");
        await createRestDoc();
    } catch (e) {
        if (failOnError)
            throw e;
        log.warn("error while creating REST-doc", e);
    }

    const sequelizeVersion = libraryHelper.getLibraryVersion("sequelize");
    if (sequelizeVersion) {
        try {
            log.info(`Installing sequelize@${sequelizeVersion} to generate docs...`);
            new EnvProxy().executeCommand_L(`npm install sequelize@${sequelizeVersion}`);
            log.info("Creating Domain-doc based on Sequelize");
            await createDomainDoc();
        } catch (e) {
            if (failOnError)
                throw e;
            log.warn("error while creating domain-doc", e);
        }
    }
    try {
        log.info(`Creating JavaScript-doc based on sourcecode inside ${sourceCodeDir}`);
        await createJsDoc()
    } catch (e) {
        if (failOnError)
            throw e;
        log.warn("error while creating js-doc", e);
    }
}

/**
 * Creates the js-docs based on the sourcecode inside of src/server
 */
async function createJsDoc() {
    const config = {files: fileHelper.getFilesInDir(sourceCodeDir, /.+\.js$/)};
    const result = jsdoc2md.renderSync(config);
    fs.writeFileSync('wiki/api-doc/Home.md', result);
}

/**
 * created the model-docs based on the sequelize-models in src/server/db/models
 */
async function createDomainDoc() {
    const config = {
        fieldBlacklist: ['createdAt', 'updatedAt'],
        models: {
            paths: ["src/server/db/models"],
            initFunction: "init",
            recursive: true

        },
        output: {
            type: 'File',
            file: {
                splitting: 'OnePerClass',
                extension: ".model.md",
                path: "./wiki/domain-doc/"
            }
        }
    };
    seq2md.render(config);
    return Promise.resolve();
}

/**
 * creates the rest-docs based on the rest-doc/main.raml
 */
async function createRestDoc() {
    const config = {
        input: {
            paths: ["rest-doc/main.raml"],
            recursive: true
        },
        output: {
            type: 'File',
            file: {
                splitting: "OnePerResource",
                extension: ".endpoint.md",
                path: "./wiki/rest-doc/"
            }
        }
    };

    return raml2md.render(config)
}

/**
 * buildDocs module.
 * @module action/buildDocs
 */

'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const gitHelper = require('./helpers/gitHelper');

const fileHelper = require('./filehandling/fileHandler');
const fs = require("fs");

const raml2md = require("raml-to-markdown");
const jsdoc2md = require("jsdoc-to-markdown");
const seq2md = require("sequelize-to-markdown");
const libraryHelper = require('./helpers/libraryHelper');

const wikiDirs = ["./wiki/rest-doc/dummy.s", "./wiki/domain-doc/dummy.d", "./wiki/api-doc/dummy.f"];
const sourceCodeDir = "src/server";

/**
 * function to create the documentation of a service
 * creates docs based on:
 *  - raml: raml-files inside the '/rest-doc' folder
 *  - sequelize: sequelize-models inside 'src/server/db/models'
 *  - jsdoc: jsdoc inside 'src/server'
 * @param config - duriel config
 * @param commit - [true | false] commit the doc-files
 */
async function buildDocs(config, commit = false) {
    if (config.get('skip_doc_building')) {
        log.info("doc building disabled by flag.");
        return;
    }
    const proxy = new EnvProxy();
    log.info("build docs");
    const packageJson = await loadPackageJson();

    const hasDocScript = packageJson && packageJson.scripts && packageJson.scripts.doc;
    const fallBackFunctions = await fetchDocFunctions(packageJson); // keep this in as it installs libs

    // if (!fallBackFunctions.length || !hasDocScript) {
    if (!hasDocScript) {
        log.info("No documentation script available for this service.");
        return;
    }
    await proxy.executeCommand_L("rm -Rf wiki");
    try {
        await proxy.executeCommand_L(`git clone https://github.com/OpusCapita/${config['serviceName']}.wiki.git wiki`);
    } catch (error) {
        log.warn("error during clong wiki", error);
        return;
    }

    await proxy.changePermission_L("777 -R", "wiki", true);

    log.info("Creating directories for wiki ");
    wikiDirs.forEach(dir => fileHelper.mkdirp(dir));
    log.debug("all directories created!");

    // if (hasDocScript) {
        await proxy.executeCommand_L("npm run doc", "build docs");
    // } else {
    //     // TODO: Execute a default doc creation?
    //     for (const docFunction of fallBackFunctions) {
    //         try {
    //             await docFunction();
    //         } catch (error) {
    //             if (commit) {
    //                 throw error;
    //             }
    //             log.error("error during creating documentation", error);
    //             return;
    //         }
    //     }
    // }
    await proxy.changeCommandDir_L("wiki");

    const changedFiles = await gitHelper.getStatus();
    log.info("changed files: ", changedFiles.map(it => it.file).join(' ,'));

    if (commit) {
        log.info("committing and pushing changes of documentation");
        if (changedFiles.length) {
            log.info("changed files: ", changedFiles);
            await gitHelper.setCredentials(config['GIT_USER'], config['GIT_EMAIL']);
            await gitHelper.addAll();
            await gitHelper.commit('updated documentation. [ci skip]');
            await gitHelper.push('master');

        } else {
            log.info("no files changed!");
        }
    }

    await proxy.changeCommandDir_L("..");
}

/**
 * Creates the js-docs based on the sourcecode inside of src/server
 */
async function createJsDoc(files, outputFile = 'wiki/api-doc/Home.md') {
    log.info("Creating docs based on jsDoc");
    files = files ? files : fileHelper.getFilesInDir(sourceCodeDir, /.+\.js$/);
    const config = {files};
    const result = jsdoc2md.renderSync(config);
    fileHelper.mkdirp(outputFile);
    fs.writeFileSync(outputFile, result);
}

/**
 * created the model-docs based on the sequelize-models in src/server/db/models
 */
async function createDomainDoc() {
    log.info("Creating docs based sequelize");
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
async function createRestDoc(override) {
    log.info("Creating docs based on raml");
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

/**
 * Fetches all types of documentation which are supported by the current service.
 * prepares the sequelize library if it is a dependency.
 * @param packageJson - content of the package.json;
 * @returns Array of functions which will create the documentations
 */
async function fetchDocFunctions(packageJson) {
    if (!packageJson) {
        return [];
    }

    const result = [];
    if (fs.existsSync('./rest-doc')) {
        log.info("Found rest-doc folder. Creating documentation based on raml!");
        result.push(createRestDoc);
    }
    const sequelizeVersion = libraryHelper.getLibraryVersion("sequelize", packageJson);
    if (sequelizeVersion && fs.existsSync('./src/server/db/models')) {
        log.info("Found sequelize dependency and models folder. Creating documentation based on sequelize-models!");
        log.info(`Installing sequelize@${sequelizeVersion} to generate docs...`);
        // await new EnvProxy().executeCommand_L(`npm install sequelize@${sequelizeVersion}`);
        await new EnvProxy().executeCommand_L(`npm install`, "npm install");
        result.push(createDomainDoc);
    }

    if (fs.existsSync('./src/server')) {
        log.info("Found server folder. creating documentation based on jsDoc");
        result.push(createJsDoc)
    }
    return result;
}

/**
 * loads the file 'package.json' and returns its content.
 * @returns content of the package.json
 */
async function loadPackageJson() {
    try {
        log.info("loading package.json");
        return await fileHelper.loadFile2Object("./package.json");
    } catch (error) {
        log.error("could not load package.json");
    }
}

/**
 * Function that simply creates a wiki-dir and executes generic doc-files.
 */
async function createAllDocFiles() {

    wikiDirs.forEach(dir => fileHelper.mkdirp(dir));

    new EnvProxy().executeCommand_L("npm install");
    await createRestDoc().catch(e => log.error(e));
    await createJsDoc().catch(e => log.error(e));
    await createDomainDoc().catch(e => log.error(e));
}

module.exports = {
    buildDocs,
    createAllDocFiles,
    createDomainDoc,
    createJsDoc,
    createRestDoc
};

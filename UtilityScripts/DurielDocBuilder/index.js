/**
 * Module to create the jsDocs of duriel
 * usage: npm run doc
 * @module
 */
'use strict';
const buildDocs = require('../../actions/buildDocs');
const fileHelper = require('../../actions/filehandling/fileHandler');


async function exec(){
    const files = fileHelper.getFilesInDir('./', /.+\.js$/).filter(it => !it.includes('node_modules'))
    console.log("Creating docs based on " + files.length + " files");
    await buildDocs.createJsDoc(files, 'wiki/Home.md');
}

exec()
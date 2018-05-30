const gitHelper = require("./GitHubHelper.js");
const supportedLanguages = require("./supportedLanguages");
const util = require("util");
const fs = require("fs");
const path = require('path');
const child_process = require('child_process');
const exportToExcel = require("./ExcelTranslationHelper").exportToExcel

/**
 * This is a map service-name { componentPath: {translationkey: { languageKey: value, languageKey2: value }}}
 * we can create a csv out of it by splitting the key in three parts: service-name; filename; translationKey; 
 * and then adding one column per language
 */
let translations = {};
let localRepoPath = "";
let skipPull = false;

init()
.then( () => getRepos() )
.then( (repos) => collectTranslationsFromRepos(repos) )
.then( (translations) => writeTranslationsToDisk(translations));

async function init() {
  return new Promise( (resolve, reject) => { 
    child_process.exec("pwd", (err, stdout, stderr) => {
      if(err) {
        console.error("error getting current path: " + stderr);
        reject("not able to pwd");
      }
      localRepoPath = stdout.substring(stdout, stdout.lastIndexOf("/"));
      console.log("using " + localRepoPath + " as github workspace");

      require("babel-register")({
        babelrc: false,
        only: /i18n\/\w+\.js/,
        presets: [localRepoPath + '/duriel/node_modules/babel-preset-es2015'],
        plugins: [localRepoPath + '/duriel/node_modules/babel-plugin-add-module-exports']
      });

      resolve(stdout);
    })
  });
}

async function writeTranslationsToDisk(translationMap) {
    for(let toLanguageId in supportedLanguages) {  
      let fromLanguageId = supportedLanguages[toLanguageId];
      if(fromLanguageId) {
        console.log("exporting excel for translation from " + fromLanguageId + " to " + toLanguageId + "...");
        await exportToExcel(translationMap, fromLanguageId, toLanguageId);
      }
    }
    console.log("translations exported!");
    return Promise.resolve();
}

/**
 * This iterates the passed repos, assuming they are in github under OpusCapita org.
 * Each repo is either cloned or pulled to reflect latest develop branch state locally.
 * Then translations are extracted into the global translations map.
 */
async function collectTranslationsFromRepos(repos) {

    // check out each repo locally
    //repos = ['einvoice-send'];
    console.log(repos);
    for(let repo of repos) {
        if(!skipPull)await gitHelper.createUpdateRepo(repo, localRepoPath, "develop");
        await extractTranslations( localRepoPath+"/"+repo, (componentId, key, languageId, value) => {
            let serviceTranslations = translations[repo];
            if(!serviceTranslations) serviceTranslations = translations[repo] = {};
            let componentTranslations = serviceTranslations[componentId];
            if(!componentTranslations) componentTranslations = serviceTranslations[componentId] = {};
            let keyTranslations = componentTranslations[key];
            if(!keyTranslations) keyTranslations = componentTranslations[key] = {};
            let existingValue = keyTranslations[languageId];
            if(existingValue) {
              console.error("duplicate value for " + fullKey + ": existing " + existingValue + ", new: " + key);
              throw "duplicate";
            }
            keyTranslations[languageId] = value;
        });
    }

    console.log("finished, translations: ", util.inspect(translations, {showHidden: false, depth: null}));
    return Promise.resolve(translations);
}

/** 
 * Iterates repo recursively, considering only i18n directories for file processing and therein only
 * files with name format $languageId.js, where $languageId is additionally checked against supported languages.
 * Matching files are dynamically required and assumed to export a flat map with key/value pairs.
 * The translations are collected via registerTranslation using 
 *   * languageId taken from filename
 *   * componentId taken from path, i.e. the relative path inside the repo to the i18n dir of the file, with slashes replaced by dots
 *   * key and value taken from the actual translation map in the file
 */
async function extractTranslations(path, registerTranslation) {
  let ignoreList = [".git", ".circleci", "test", "usecases", "wiki"];
  console.log("extracting translations, path=" + path);
  fromDir( path, 
           (dirname) => {
             return !(ignoreList.indexOf(dirname.substring(dirname.lastIndexOf("/")+1, dirname.length)) > -1);
           },
           (dirname) => {
             return dirname.substring(dirname.lastIndexOf("/")+1, dirname.length) == "i18n";
           }, 
           (filename) => {
             let extension = filename.substring(filename.lastIndexOf(".")+1, filename.length);
             let languageId = filename.substring(filename.length-extension.length-3, filename.length-extension.length-1);
             return ( extension == "js" || extension == "json" ) && supportedLanguages.hasOwnProperty(languageId) ;
           }, 
           (filename) => {
             console.log("identified translation file: " + filename);
             let languageId = filename.substring(filename.lastIndexOf("/")+1, filename.lastIndexOf("."));
             let componentId = filename.substring(path.length+1, filename.lastIndexOf("/i18n"));//.replace(/\//g, ".");
             console.log("languageId = " + languageId + ", componentId = " + componentId);
             let extension = filename.substring(filename.lastIndexOf(".")+1, filename.length);
             let translations = require(filename);
             try {
                 translations = flattenObject(translations);
                 for(tkey in translations) {
                     registerTranslation(componentId, tkey, languageId, translations[tkey]);
                 }
             }
             catch(err) {
                 console.error("Unable to flatten translation map " + filename);
             }
           }
         );
}

function flattenObject(obj) {
    let toReturn = {};
	
    for (let i in obj) {
        if (!obj.hasOwnProperty(i)) continue;
        if (obj[i] instanceof Function) {
          throw "format error: translation map has function properties";
        }
        else if ((typeof obj[i]) == 'object') {
            let flatObject = flattenObject(obj[i]);
            for (let x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;
                toReturn[i + '.' + x] = flatObject[x];
            }
        } 
        else {
            toReturn[i] = obj[i];
        }
    }
    return toReturn;
};

/**
 * Recurses through directories rooted at startPath and calls fileProcessor on each file matching criteria.
 * Behaviour can be controlled via
 *   * boolean recurseIntoDir(fullPath)    - whether to recurse into the directory or not
 *   * boolean processFilesInDir(fullPath) - whether files in the directory should be considered at all for processing
 *   * boolean fileFilter(fullFilePath)    - whether fileProcessor is to be called for the given file
 *   * void fileProcessor(fullFilePath)    - do whatever on the selected file
 */
function fromDir(startPath, recurseIntoDir, processFilesInDir, fileFilter, fileProcessor){
    if (!fs.existsSync(startPath)){
        console.log("no dir ",startPath);
        return;
    }

    var files=fs.readdirSync(startPath);
    for(var i=0;i<files.length;i++){
        var filename=path.join(startPath,files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory() && recurseIntoDir(filename)  ){
//          console.log("recursing into " + files[i]);
          fromDir(filename,recurseIntoDir, processFilesInDir, fileFilter, fileProcessor); //recurse
        }
        else if (processFilesInDir(startPath) && fileFilter(filename)) fileProcessor(filename);
    };
};

/**
 * Gets the list of repos for translation from github api
 */
async function getRepos() {

  //return ["bnp","onboarding","pdf2invoice","supplier","auth","kong","api-registrator","isodata","redis","einvoice-send","email","user","elasticsearch","logstash","kibana","customer","notification","blob","acl","sales-invoice","a2a-integration","servicenow-integration","andariel-monitoring","service-base-ui","rabbitmq","sales-order","tnt","sirius","andariel-sirius-bridge","redis-commander","routing","business-link"];

  return gitHelper.iterateRepos([ ["microservice", "andariel", "sirius"], ["microservice", "bnp"], ["andariel", "microservice", "platform"], ["andariel", "library", "platform", "i18n"] ]);
}

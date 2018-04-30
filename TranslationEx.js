const gitHelper = require("./GitHubHelper.js");
const supportedLanguages = ["de", "en"];
const fs = require("fs");
const path = require('path');
const child_process = require('child_process');
const exportToExcel = require("./TranslationExcelExport.js");
/**
 * This is a map service-name.filename.translationkey: { languageKey: value, languageKey2: value }
 * we can create a csv out of it by splitting the key in three parts: service-name; filename; translationKey; 
 * and then adding one column per language
 */
let translations = {};
let localRepoPath = "";

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
  var json = JSON.stringify(translationMap, null, 4); 
  await exportToExcel(translationMap, "en", "de");
  return new Promise( (resolve, reject) => {
    fs.writeFile('translations.json', json, (err) => {
      if(err) reject(err);
      console.log("translations saved!");
      resolve();
    });  
  });
}

/**
 * This iterates the passed repos, assuming they are in github under OpusCapita org.
 * Each repo is either cloned or pulled to reflect latest develop branch state locally.
 * Then translations are extracted into the global translations map.
 */
async function collectTranslationsFromRepos(repos) {

  // check out each repo locally
  console.log(repos);
  let repo = repos[0];
  console.log("localRepoPath = " + localRepoPath);
  await gitHelper.createUpdateRepo(repo, localRepoPath, "develop");
  await extractTranslations( localRepoPath+"/"+repo, (componentId, key, languageId, value) => {
    let fullKey = repo + "." + componentId + "." + key;
    let keyTranslations = translations[fullKey];
    if(!keyTranslations) keyTranslations = translations[fullKey] = {};
    let existingValue = keyTranslations[languageId];
    if(existingValue) {
      console.error("duplicate value for " + fullKey + ": existing " + existingValue + ", new: " + key);
      throw "duplicate";
    }
    keyTranslations[languageId] = value;
  });

  console.log("finished, translations: ", translations);
  return Promise.resolve(translations);
}

/** 
 * Iterates repo recursively, considering only i18n directories for file processing and therein only
 * files with name format $languageId.js, where $languageId is additionally checked against supported languages.
 * Matching files are dynamically required and assumed to export a flat map with key/value pairs.
 * The translations are collected via registerTranslationCallback using 
 *   * languageId taken from filename
 *   * componentId taken from path, i.e. the relative path inside the repo to the i18n dir of the file, with slashes replaced by dots
 *   * key and value taken from the actual translation map in the file
 */
async function extractTranslations(path, registerTranslationCallback) {
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
             return filename.endsWith(".js") && supportedLanguages.indexOf(filename.substring(filename.length-5, filename.length-3)) > -1;
           }, 
           (filename) => {
             console.log("identified translation file: " + filename);
             let languageId = filename.substring(filename.lastIndexOf("/")+1, filename.lastIndexOf("."));
             let componentId = filename.substring(path.length+1, filename.lastIndexOf("/i18n")).replace(/\//g, ".");
             console.log("languageId = " + languageId + ", componentId = " + componentId);
             let translations = require(filename);
             for(tkey in translations) {
               registerTranslationCallback(componentId, tkey, languageId, translations[tkey]);
             }
           }
         );
}

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
          console.log("recursing into " + files[i]);
          fromDir(filename,recurseIntoDir, processFilesInDir, fileFilter, fileProcessor); //recurse
        }
        else if (processFilesInDir(startPath) && fileFilter(filename)) fileProcessor(filename);
    };
};

/**
 * Gets the list of repos for translation from github api
 */
async function getRepos() {

  return ["bnp","onboarding","pdf2invoice","supplier","auth","kong","api-registrator","isodata","redis","einvoice-send","email","user","elasticsearch","logstash","kibana","customer","notification","blob","acl","sales-invoice","a2a-integration","servicenow-integration","andariel-monitoring","service-base-ui","rabbitmq","sales-order","tnt","sirius","andariel-sirius-bridge","redis-commander","routing","business-link"];

  gitHelper.iterateProjects([ ["microservice", "andariel", "sirius"], ["microservice", "bnp"], ["andariel", "microservice", "platform"], ["andariel", "library", "platform", "i18n"] ])
  .then( (repos) => {
    console.log("repos: " + repos);
  });
}

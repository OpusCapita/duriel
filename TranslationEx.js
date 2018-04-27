const gitHelper = require("./GitHubHelper.js");
const supportedLanguages = ["de", "en"];
const fs = require("fs");
const path = require('path');

/**
 * This is a map service-name.filename.translationkey: { languageKey: value, languageKey2: value }
 * we can create a csv out of it by splitting the key in three parts: service-name; filename; translationKey; 
 * and then adding one column per language
 */
let translations = {};
let localRepoPath = "/home/gr4per";

getRepos()
.then( (repos) => collectTranslationsFromRepos(repos) );


async function collectTranslationsFromRepos(repos) {

  // check out each repo locally
  console.log(repos);
  let repo = repos[0];
  await gitHelper.createUpdateRepo(repo, localRepoPath, "develop");
  await extractTranslations( localRepoPath+"/"+repo, (componentId, key, languageId, value) => {
    let fullKey = reponame + "." + componentId + "." + key;
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
}

async function extractTranslations(path, callback) {
  fromDir(path, (filename) => {
    return filename.endsWith(".js") && supportedLanguages.indexOf(filename.substring(filename.length-5, filename.length-3)) > -1;
  }, false, (filename) => {
    console.log("identified translation file: " + filename);
  });
}

function fromDir(startPath,filter, checkFiles, callback){
    let ignoreList = [".git", ".circleci", "test", "usecases", "wiki"];
    //console.log('Starting from dir '+startPath+'/');

    if (!fs.existsSync(startPath)){
        console.log("no dir ",startPath);
        return;
    }

    var files=fs.readdirSync(startPath);
    for(var i=0;i<files.length;i++){
        //console.log("traversing " + files[i]);
        var filename=path.join(startPath,files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory() && !( ignoreList.indexOf(files[i]) > -1)  ){
          console.log("recursing into " + files[i]);
          fromDir(filename,filter,files[i]=="i18n", callback); //recurse
        }
        else if (checkFiles && filter(filename)) callback(filename);
    };
};

async function getRepos() {

  return ["bnp","onboarding","pdf2invoice","supplier","auth","kong","api-registrator","isodata","redis","einvoice-send","email","user","elasticsearch","logstash","kibana","customer","notification","blob","acl","sales-invoice","a2a-integration","servicenow-integration","andariel-monitoring","service-base-ui","rabbitmq","sales-order","tnt","sirius","andariel-sirius-bridge","redis-commander","routing","business-link"];

  gitHelper.iterateProjects([ ["microservice", "andariel", "sirius"], ["microservice", "bnp"], ["andariel", "microservice", "platform"], ["andariel", "library", "platform", "i18n"] ])
  .then( (repos) => {
    console.log("repos: " + repos);
  });
}

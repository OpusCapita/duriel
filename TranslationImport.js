const supportedLanguages = require("./supportedLanguages");
const importFromExcel = require("./ExcelTranslationHelper").importFromExcel;
const child_process = require("child_process");
const util = require("util");
const gitHelper = require("./GitHubHelper.js");
const fs = require("fs");
const fileExists = util.promisify(fs.access);

let localRepoPath = "";
let durielPath = "";
let translationMap = {};
let languagesToConsider = [];
process.argv.forEach( (val,index) => {
  if(index > 1) languagesToConsider.push(val);
});
console.log("considered languages = " + languagesToConsider);
//process.exit(0);

init()
.then( () => importFromExcel(durielPath, languagesToConsider, translationMap) )
.then( (allTranslations) => applyTranslationsToServices(allTranslations, languagesToConsider) )
.then( () => { console.log("DONE"); });

async function applyTranslationsToServices(allTranslations, languages) {
    console.log("all files imported"); 
    for (let serviceName in allTranslations) {
        if(serviceName == "sales-invoice") continue;
        
        let repo = serviceName;
        console.log("updating repo " + repo + " in directory " + localRepoPath + " ...");
        await gitHelper.createUpdateRepo(repo, localRepoPath, "develop");
        //i18n-translation-2018-05-30T15:03:20.560Z
        let branchname = "i18n-translation-" + new Date().toISOString().substring(0,19).replace(/:/g,"");
        await gitHelper.branch(repo, localRepoPath, branchname);
        //await gitHelper.checkout(repo, localRepoPath, branchname);
  
        let serviceTranslations = allTranslations[serviceName];

        console.log("applying to service " + serviceName);
        
        for(let componentId in serviceTranslations) {
            let componentTranslations = serviceTranslations[componentId];
            console.log("applying to component " + componentId + " in service " + serviceName);
            let i18nFolder = componentId + "/i18n";
            await applyTranslationsToComponent(localRepoPath, serviceName, i18nFolder, componentTranslations, languages);
        }
        await gitHelper.add(repo, localRepoPath);
        await gitHelper.commit(repo, localRepoPath, "auto import from translation excel"); 
        await gitHelper.push(repo, localRepoPath, branchname);
        await gitHelper.createPR(repo, branchname);
    }
}

async function applyTranslationsToComponent(localRepoPath, repo, i18nFolder, translations, languages) {
    let componentFolder = localRepoPath + "/" + repo + "/" + i18nFolder;
    try {
        await fileExists(componentFolder);    
    }
    catch(err) {
        console.error("folder " + componentFolder + " doesnt exist");
        throw err;
    }
    console.log("writing index.js...");
    await writeIndexJs(componentFolder, supportedLanguages);
    for(let languageId of languages) {
        console.log("writing json bundle for language " + languageId + " ...");
        await writeJSONBundle(componentFolder, languageId, translations);
    }
}

async function writeJSONBundle(componentFolder, languageId, translations) {
    let payload = {};
    for(let key in translations) {
        let keyPieces = key.split(".");
        let target = payload;
        let prevTarget = payload;
        let keyPiece;
        for(keyPiece of keyPieces) {
          let nextTarget = target[keyPiece];
          if(!nextTarget) nextTarget = target[keyPiece] = {};
          prevTarget = target;
          target = nextTarget;
        }
        prevTarget[keyPiece] = translations[key][languageId];
    }
    console.log("payload = " + JSON.stringify(payload));
    fs.writeFileSync(componentFolder + "/" + languageId + ".json", JSON.stringify(payload, null, 4)); //process.exit(1);
}

async function writeIndexJs(componentFolder, supportedLanguages) {
    let payload = "// this file was auto generated by duriel, don't manually change it!\n\n";
    let exportStr = "module.exports = {";
    for(let languageId in supportedLanguages) {
        payload += "const " + languageId + " = require('./" + languageId + ".json');\n";
        exportStr += languageId + ", ";
    }
    exportStr = exportStr.substring(0, exportStr.length -2);
    payload += "\n" + exportStr + " };\n"
    fs.writeFileSync(componentFolder + "/index.js", payload);
}

async function init() {
  return new Promise( (resolve, reject) => {
    child_process.exec("pwd", (err, stdout, stderr) => {
      if(err) {
        console.error("error getting current path: " + stderr);
        reject("not able to pwd");
      }
      durielPath = stdout.substring(0, stdout.length-1);
      localRepoPath = stdout.substring(0, stdout.lastIndexOf("/"));
      console.log("using " + localRepoPath + " as github workspace");

      resolve(stdout);
    })
  });
}


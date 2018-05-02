const supportedLanguages = require("./supportedLanguages");
const importFromExcel = require("./ExcelTranslationHelper").importFromExcel;
const child_process = require("child_process");
const util = require("util");

let localRepoPath = "";
let durielPath = "";
let translationMap = {};

init()
.then( () => importFromExcel(durielPath, supportedLanguages, translationMap) )
.then( (allTranslations) => {
  console.log("all files imported, translations:", util.inspect(allTranslations, {showHidden: false, depth: null} ));
});

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


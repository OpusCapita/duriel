const flattenObject=require("./TranslationExport.js").flattenObject;
const child_process = require('child_process');
const fs = require("fs");

function printUsage() {
  console.log("node JS2JSON.js srcPath [destPath]");
}

console.log("process.argv=", process.argv);
let srcPath = process.argv[2];
let destPath = process.argv[3];

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
      console.log("finished init");
      resolve(stdout);
    })
  });
}
init()
.then( () => { return run(srcPath, destPath)});

async function run(srcPath, destPath) {
  console.log("srcPath=" + srcPath);
  let srcTranslations = require("" + srcPath);
  let srcFolder = srcPath.substring(0, srcPath.lastIndexOf('/'));
  let srcLanguage = srcPath.substring(srcPath.lastIndexOf('/')+1,srcPath.lastIndexOf('.'));
  console.log("componentFolder=" + srcFolder); 
  console.log("srcLanguage=" + srcLanguage);
  let flatdata = await flattenObject(srcTranslations);
  if( ! destPath) destPath = srcFolder;
  await writeJSONBundle(destPath, srcLanguage, srcTranslations);
  console.log("successfully written file...");
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
        prevTarget[keyPiece] = translations[key];
    }
    console.log("payload = " + JSON.stringify(payload));
    fs.writeFileSync(componentFolder + "/" + languageId + ".json", JSON.stringify(payload, null, 4)); //process.exit(1);
}





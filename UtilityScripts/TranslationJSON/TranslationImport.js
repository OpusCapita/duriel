/**
 * @module
 */
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

if (process.argv.length < 4)
{
    console.log("Usage: node UtilityScripts/TranslationJSON/TranslationImport.js BRANCHNAME LANGUAGEID [LANGUAGEIDs]")
    process.exit(1);
}

const branchname = process.argv[2];

process.argv.forEach( (val,index) => {
  if(index > 2) languagesToConsider.push(val);
});

console.log("");
console.log("Importing translations")
console.log(" - into branch  :", branchname);
console.log(" - for languages: " + languagesToConsider);
console.log("");
// process.exit(0);

init()
.then( () => importFromExcel(durielPath, languagesToConsider, translationMap) )
.then( (allTranslations) => {
    console.log("All files imported.");
    return applyTranslationsToServices(allTranslations, languagesToConsider);
})
.then( () => { console.log("DONE"); })
.catch(error => { console.log("Error: ", error)});

async function applyTranslationsToServices(allTranslations, languages)
{
    console.log("")
    console.log("Translations found for");
    console.log("----------------------");
    Object.keys(allTranslations).forEach((serviceName, index) => console.log(`  ${index + 1}. ${serviceName}`));

    let index = 1;
    for (let repositoryName in allTranslations)
    {
        let repo = repositoryName;

        console.log("");
        console.log(`${index++}. ${repositoryName}`);
        console.log("=================================================================================");
        console.log("updating repo " + repositoryName + " in directory " + localRepoPath + " ...");

        // if(!["supplier", "isodata", 'sales-invoice', 'onboarding'].includes(repositoryName)) continue;
        // if(!["service-base-ui"].includes(repositoryName)) continue;

        console.log("");
        console.log("Preparing local copy of the repository");
        console.log("--------------------------------------");
        await gitHelper.createUpdateRepo(repositoryName, localRepoPath, branchname);

        console.log("");
        console.log("Applying translations into local copy");
        console.log("-------------------------------------");
        let serviceTranslations = allTranslations[repositoryName];

        // console.log("\nvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv");
        // console.log(allTranslations[repositoryName]);
        // console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n");

        for (let componentId in serviceTranslations) {

            if(["service-base-ui"].includes(repositoryName) && componentId === "menu")
            {
                console.log("Could not apply 'menu' translations for service-base-ui in an automated way. Please treat this translations manually. Omitting this component!");
                continue;  // manually action as long as the menues are not translated properly
            }

            let componentTranslations = serviceTranslations[componentId];
            console.log("applying to component " + componentId + " in service " + repositoryName);
            let i18nFolder = componentId + "/i18n";
            await applyTranslationsToComponent(localRepoPath, repositoryName, i18nFolder, componentTranslations, languages);
        }

        console.log("");
        console.log("Pushing changes to github");
        console.log("-------------------------");
        await gitHelper.add(repositoryName, localRepoPath);
        try {
            // TODO: Committing without changes runs into an error! Check whether we need a commit (any changed files) at all and suppress next steps.
            //       (Maybe branch should be removed, too.)
            await gitHelper.commit(repositoryName, localRepoPath, "auto import from translation excel");
            await gitHelper.push(repositoryName, localRepoPath, branchname);
            await gitHelper.createPR(repositoryName, branchname);
        }
        catch(error) {
            console.log("Error at commit, push, create steps: ", error);
        }
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
    console.log(` - ${componentFolder}/index.js`);
    await writeIndexJs(componentFolder, supportedLanguages, languages);
    for(let languageId of languages) {
        console.log(` - ${componentFolder}/${languageId}.json`);
        await writeJSONBundle(componentFolder, languageId, translations);
    }
}

async function writeJSONBundle(componentFolder, languageId, translations) {
    let payload = {};
    for(let key in translations)
    {
        // Notation: dot separated keys
        payload[key] = translations[key][languageId];
    }
    // console.log("payload = " + JSON.stringify(payload));
    fs.writeFileSync(componentFolder + "/" + languageId + ".json", JSON.stringify(payload, null, 4)); //process.exit(1);
}

async function writeIndexJs(componentFolder, supportedLanguages, importLanguages) {
    let payload = "// this file was auto generated by duriel, don't manually change it!\n\n";

    let languages = ["en"];

    // read existing languages from current folder
    let files = fs.readdirSync(componentFolder);

    files.forEach(filename => {
        const result = filename.match(/^(.{2})\.json$/);
        const lang = result && result[1];
        if (result && supportedLanguages[lang])
            languages.push(lang);
    });

    // add import languages, but avoid duplicates
    importLanguages.forEach(lang => {
        if (!languages.includes(lang) && supportedLanguages[lang])
            languages.push(lang);
    });

    languages.sort().forEach(languageId => {
        payload += "const " + languageId + " = require('./" + languageId + ".json');\n";
    });
    payload += "\n";
    payload += "module.exports = {" + languages.join(", ") + "};\n";

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

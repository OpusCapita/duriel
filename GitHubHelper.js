const request = require('superagent');
const util = require("util");
const fs = require("fs");
const fileExists = util.promisify(fs.access);
const child_process = require('child_process');
//const exec = util.promisify(require('child_process').exec);

let result;
module.exports.iterateRepos = iterateRepos;
module.exports.createUpdateRepo = createUpdateRepo;

//createUpdateRepo("dummy", "/home/gr4per", "develop")
//.catch( (err) =>  {
//  console.error("process failed");
//});

/**
 * Will check local path if repo already there, if not will clone it first
 * Then will checkout requested branch
 * Then will pull to get current version
 */
async function createUpdateRepo(reponame, localPath, branchname) {
  repoPath = localPath + "/" + reponame;
  return fileExists(repoPath)
  .then( (exists) => {
    console.log(repoPath + " exists");
    return Promise.resolve();
  })
  .catch( (err) => { 
    console.log(repoPath + " doesnt exist, cloning");
    return clone(reponame, localPath);
  })
  .then( () => { return checkout(reponame, localPath, branchname)})
  .then( () => pull(reponame, localPath) )
  .catch( (err) => {
    console.error("unable to createUpdateRepo " + repoPath + ": \n", err);
//    throw err;
  });
}

async function exec(command) {
  return new Promise( (resolve, reject) => {
    child_process.exec(command, (err, stdout, stderr) => {
      if(err) {
//        console.log("rejecting, err=", err.code, "stderr=", stderr, "stdout=", stdout);
        reject(stderr);
      }
      else {
//        console.log("resolving, out=" + stdout + ", \nerr=" + stderr);
        resolve({"stdout": stdout, "stderr": stderr} );
      }
    });
  });
}

async function clone(reponame, localPath) {
  //console.log("cloning " + reponame + " to " + localPath + "/");
  try {
    console.log("attempting clone of " + reponame + " to " + localPath);
    let output = await exec("git clone ssh://git@github.com/OpusCapita/" + reponame + " " + localPath+"/"+reponame);
    console.log("cloning finished, output=", output);

  }
  catch(err) {
    console.error("cloning failed: ", err);
//    throw err;
  }
}

async function checkout(reponame, localPath, branchname) {
  console.log("checking out branch " + branchname + " in " + localPath + "/" + reponame);
  let output = await exec("cd " + localPath + "/" + reponame + "; git checkout " + branchname);
  console.log("checked out branch, output=", output);
}

async function pull(reponame, localPath) {
  console.log("pulling repo " + localPath + "/" + reponame);
  let output = await exec("cd " + localPath + "/" + reponame + "; git pull");
  console.log("pull done, output=", output);
}

/**
 * topics - takes an array of arrays as topics filter
 *   the list of repos returned are matched against each topics entry array and matching if the repo has all labels in the topics element
 *   Example: topics = [ ["bnp", "microservice"], ["ipa", "microservice"] ]
 *   returns all OpusCapita repos that either have bnp AND microservice as topics or ipa and microservice
 */
async function iterateRepos(topics) {
  if(!process.env.GIT_TOKEN) {
    console.error("GIT_TOKEN needs to be set as ENV");
    process.exit(1);
  }
  let url = "https://api.github.com/orgs/OpusCapita/repos";
  let nextPageUrl = url;
  let repos = [];

  let page = 1;
  while(true) {
    let res;
    try {
      res = await request
      .get(nextPageUrl)
      .set("Authorization", "token " + process.env.GIT_TOKEN)
      .set("Accept", "application/vnd.github.mercy-preview+json")
    }
    catch(err) {
      console.error("request failed: ", err, res);
    }
    if(res.status != 200) {
      console.error("received unexpected status: " + res.status, res);
    }
    console.log("page " + page);
    //console.log(res.body);
    res.body.forEach( (elem) => {
      //console.log(elem.name + " has topics: " + elem.topics + ", is private: " + elem.private);
      let ok = false;
      for(andTopic of topics) { 
        //console.log("checking ", andTopic, " to be in ", elem.topics);
        let allMatch = true;
        for(topic of andTopic) {
          if(!elem.topics.includes(topic)) {
            allMatch = false;
            break;
          }
        }
        if(allMatch) {
          ok = true;
          break;
        }
      }
      if(ok) { 
        //console.log("adding " + elem.name);
        repos.push(elem.name);
      }
    });
    let nextPage = res.header["link"].split(",").find( (elem) => {return elem.indexOf("rel=\"next\"") > -1} );
    console.log("nextPage: ", nextPage);
    if(!nextPage) {
      console.log("all pages iterated");
      return Promise.resolve(repos);
    }
    nextPageUrl = nextPage.substring(nextPage.indexOf("<")+1, nextPage.lastIndexOf(">"));
    console.log("link: " + nextPage);
    console.log("nextPageUrl=" + nextPageUrl);
    page++;
    //if(page > 1) break;
  }
}


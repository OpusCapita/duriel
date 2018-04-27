const iterateProjects = require("./GitHubHelper.js");


getRepos()
.then( (repos) => {
  // check out each repo locally
  console.log(repos);
});

async function getRepos() {

  return ["bnp","onboarding","pdf2invoice","supplier","auth","kong","api-registrator","isodata","redis","einvoice-send","email","user","elasticsearch","logstash","kibana","customer","notification","blob","acl","sales-invoice","a2a-integration","servicenow-integration","andariel-monitoring","service-base-ui","rabbitmq","sales-order","tnt","sirius","andariel-sirius-bridge","redis-commander","routing","business-link"];

  iterateProjects([ ["microservice", "andariel", "sirius"], ["microservice", "bnp"], ["andariel", "microservice", "platform"], ["andariel", "library", "platform", "i18n"] ])
  .then( (repos) => {
    console.log("repos: " + repos);
  });
}

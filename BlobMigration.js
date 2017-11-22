var ApiHelper = require('./ApiHelper.js');
var EnvProxy = require('./EnvProxy.js');
var mysql = require('mysql2/promise');
var envInfo = require('./envInfo.js');
var https = require('https');

if(process.argv.length < 4) {
  console.log("missing command line args");
  printUsage();
}

function printUsage() {
  console.log("node BlobMigration.js :srcEnv :targetEnv");
  process.exit(1);
}

var srcEnv = process.argv[2];
var destEnv = process.argv[3];

let srcApiSecretEnv = 'SECRET_' + srcEnv + '_oidcCLIENT';
let destApiSecretEnv = 'SECRET_' + destEnv + '_oidcCLIENT';
if(!process.env[srcApiSecretEnv]) {
  console.log("env var " + srcApiSecretEnv + " not set!");
  process.exit(1);
}
if(!process.env[destApiSecretEnv]) {
  console.log("env var " + destApiSecretEnv + " not set!");
  process.exit(1);
}

let srcApiPasswordEnv = 'SECRET_' + srcEnv + '_USERPASS';
let destApiPasswordEnv = 'SECRET_' + destEnv + '_USERPASS';
if(!process.env[srcApiPasswordEnv]) {
  console.log("env var " + srcApiPasswordEnv + " not set!");
  process.exit(1);
}
if(!process.env[destApiPasswordEnv]) {
  console.log("env var " + destApiPasswordEnv + " not set!");
  process.exit(1);
}

let srcApiSecret=process.env[srcApiSecretEnv];
let destApiSecret=process.env[destApiSecretEnv];
let srcApiPassword=process.env[srcApiPasswordEnv];
let destApiPassword=process.env[destApiPasswordEnv];

var srcApiHelper;
var destApiHelper;

var destEnvProxy;
var srcEnvProxy;

var srcDbSession;
var destDbSession;
var srcDbSecretEnv = 'SECRET_' + srcEnv + '_MYSQL';
var srcDbPassword = process.env[srcDbSecretEnv];
if(!srcDbPassword) {
  console.log("required env %s is not set!", srcDbSecretEnv);
  process.exit(1);
}
var destDbSecretEnv = 'SECRET_' + destEnv + '_MYSQL';
var destDbPassword = process.env[destDbSecretEnv];
if(!destDbPassword) {
  console.log("required env %s is not set!", destDbSecretEnv);
  process.exit(1);
}

init()
.then( () => {
  return srcDbSession.query('SELECT tenantId, id FROM blob.TenantContainerMapping;');
})
.then( (result) => {
  var rows = result[0];
  console.log("rows = " + JSON.stringify(rows));
  //for(var i = 0; i < rows.length; i++) {
  //  console.log("row " + i + " %o", rows[i]);
  //}
  console.log('srcDbPassword = "' + srcDbPassword + '"');
  return Promise.all([rows, destDbSession.query('SELECT tenantId, id FROM blob.TenantContainerMapping;')]);
})
.then( ([srcRows, result]) => {
  var destRows = result[0];
  let srcContainerMap = {};
  let destContainerMap = {};
  
  // now we need to iterate and compare the two sets
  for(let i = 0; i < destRows.length; i++) {
    destContainerMap[destRows[i].tenantId] = destRows[i].id;
  }
  return (function loop(i) {
    console.log("called loop(" + i + ")");
    if(i<srcRows.length) {
      let tenantId = srcRows[i].tenantId;
      let tenantInfo = srcContainerMap[tenantId] = {containerId:srcRows[i].id,
                                   destContainerId:destContainerMap[tenantId]};
      console.log("tenant " + tenantId + ": \nsrcContainer " 
                  + srcContainerMap[tenantId].containerId 
                  + "\ndestContainer " + srcContainerMap[tenantId].destContainerId);
      return handleTenant(tenantInfo)
      .then(loop(i+1));
    }
  })(0);
})
.catch( (err) => {
  console.log('Error: ' + err);
});

function handleTenant(tenantInfo) {
  return ensureTenantContainerExists(tenantInfo)
  .then( (destContainerId) => {
    // now synch the files
    tenantInfo.destContainerId = destContainerId;
    return syncDirectory(tenantInfo, '/');
  })
}

function syncDirectory(tenantInfo, path) {
  return apiHelper.get('blob/api/' + tenantInfo.tenantId + '/files' + path)
  .then( (response) => {
    for(let i = 0; i < response.data.length; i++) {
      console.out('srcFile ' + reponse.data[i].path + ", size " + response.data[i].size + ", isDir = " + response.data[i].isDirectory);
    }
    process.exit(1);
  });
}

function ensureTenantContainerExists(tenantInfo) {
  if(!tenantInfo.destContainerId) {
    console.log("tenantId not present on dest blob, creating it");
    return destApiHelper.put('blob/api/' + tenantInfo.tenantId + "/files/delete.me",
                             'please delete me')
    .then( (response) => {
      if(response.status == 202) {
        console.log("tenant " + tenantInfo.tenantId + ": container created on dest ");
        return destDbSession.query("SELECT id FROM blob.TenantContainerMapping where tenantId = '" + tenantInfo.tenantId + "';")
        .then( (result) => {
          return result[0][0].id;
        })
      }
      else throw "Not able to create dest container for tenant " + tenantInfo.tenantId + ", error status is " + response.status;
    })
  }
  return tenantInfo.destContainerId;
}

/**
 * initialize connection to target and src env
 */
function init() {
  return new EnvProxy().init(envInfo.develop)
  .then( (proxy) => {
    srcEnvProxy = proxy;
    console.log("srcEnvProxy created");
  })
  .then( () => {
    return new EnvProxy().init(envInfo.pr2);
  })
  .catch( (err) => {
    console.log("error connecting to " + destEnv + ": %o", err);
    process.exit(1);
  })
  .then( (proxy) => {
    destEnvProxy = proxy;
    return srcApiHelper = new ApiHelper().init({clientSecret: srcApiSecret, host: envInfo[srcEnv].public_hostname, password: srcApiPassword});
  })
  .then( () => {
    return destApiHelper = new ApiHelper().init({clientSecret: destApiSecret, host: envInfo[destEnv].public_hostname, password: destApiPassword, http: {httpsAgent: new https.Agent({rejectUnauthorized: false})}});
  })
  .then( () => {
    return mysql.createConnection({
      host: 'localhost',
      port: srcEnvProxy.proxyServers['mysql'].port,
      user: 'root',
      password: srcDbPassword
    });
  })
  .then( (conn) => {
    srcDbSession = conn;
    return mysql.createConnection({
      host: 'localhost',
      port: destEnvProxy.proxyServers['mysql'].port,
      user: 'root',
      password: destDbPassword
    });
  })
  .then( (conn) => {
    destDbSession = conn;
    return Promise.resolve("done");
  })
  .catch( (err) => {
    console.log("error: %o", err);
    throw err;
  });
}


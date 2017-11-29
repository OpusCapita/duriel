var ApiHelper = require('./ApiHelper.js');
var EnvProxy = require('./EnvProxy.js');
var mysql = require('mysql2/promise');
var envInfo = require('./envInfo.js');
var https = require('https');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const fs_open = Promise.promisify(require('fs').open);

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
                                   destContainerId:destContainerMap[tenantId],
                                   tenantId: tenantId};
      console.log("tenant " + tenantId + ": \nsrcContainer " 
                  + srcContainerMap[tenantId].containerId 
                  + "\ndestContainer " + srcContainerMap[tenantId].destContainerId);
      return handleTenant(tenantInfo)
      .catch( (err) => {
        console.log(err);
        process.exit(1);
      })
      .then( () => { return loop(i+1); });
    }
    return Promise.resolve(null);
  })(0);
})
.catch( (err) => {
  console.log('Error: ', err);
});

function handleTenant(tenantInfo) {
  return ensureTenantContainerExists(tenantInfo, 'dest')
  .then( (destContainerId) => {
    // now synch the files
    tenantInfo.destContainerId = destContainerId;
    return ensureTenantContainerExists(tenantInfo, 'src');
  })
  .then( () => {
    return syncDirectory(tenantInfo, '/public/');
  })
  .then( () => {
    return syncDirectory(tenantInfo, '/private/');
  })
}

function syncFile(tenantInfo, path) {
  console.log("syncing directory " + path + " for tenant " + tenantInfo.tenantId);
  return srcApiHelper.get('blob/api/' + tenantInfo.tenantId + '/files' + path, {responseType:'stream'})
  .then( (response) => {
    let fsObj = response.headers['x-file-info'];
    if(!fsObj) {
      console.log("no fileObj in response\nresponse data: %o", response.headers);
      process.exit(1);
    }
    fsObj = JSON.parse(fsObj);
    console.log("fsObj: %o ", fsObj);
    return fs_open( '/home/gr4per/test/' + fsObj.name, 'w')
    .then( (fd) => {
      let wstream = fs.createWriteStream( 'file:///home/gr4per/test/' + fsObj.name, {fd:fd});
      response.data.pipe(wstream);
      response.data.on('end', function() {console.log("piping done on " + fsObj.name);});
      console.log("started piping");
    })
    //return destApiHelper.put('blob/api/' + tenantInfo.tenantId + '/files' + path + '?createMissing=true', response.data)
  })

}

function syncDirectory(tenantInfo, path) {
  console.log("syncing directory " + path + " for tenant " + tenantInfo.tenantId);
  return srcApiHelper.get('blob/api/' + tenantInfo.tenantId + '/files' + path)
  .then( (response) => {
    console.log("going to sync " + response.data.length + " files from src to dest: %o", response.data);
//    process.exit(1);
    return destApiHelper.get('blob/api/' + tenantInfo.tenantId + '/files' + path)
    .then( (destResponse) => {
      return [response.data, destResponse.data];
    })
    .catch( (err) => {
      console.log("error reading dest dir: ", err);
      return [response.data, null];
    })
  })
  .then( ([srcFileList, destFileList]) => {

    return (function fileloop(i) {
    console.log("called file loop(" + i + ")");
    if(i<srcFileList.length) {
      console.log('srcFile ' + srcFileList[i].path + ", size " + srcFileList[i].size + ", isDir = " + srcFileList[i].isDirectory);
      let srcDirEntry = srcFileList[i];
      let filePath = srcDirEntry.path;
      let destDirEntry = null;
      if(destFileList) destDirEntry = destFileList.find(function(elem){ return elem.path == filePath });
      let p = null;
      if( srcDirEntry.isDirectory ) {
        if(!filePath.endsWith('/')) filePath += '/';
        p = syncDirectory(tenantInfo, filePath);
      }
      else if ( destDirEntry && srcDirEntry.checksum == destDirEntry.checksum ) {
        console.log("src and dest have same checksum, skipping file sync for " + filePath);
        p = Promise.resolve(null);
      }
      else 
        p = syncFile(tenantInfo, filePath);
       
      return p
      .then( () => { return fileloop(i+1); });
    }
    return Promise.resolve(null);
  })(0);

    for(let i = 0; i < srcFileList.length; i++) {
      console.log('srcFile ' + srcFileList[i].path + ", size " + srcFileList[i].size + ", isDir = " + srcFileList[i].isDirectory);
      let filePath = srcFileList[i].path;
      let destDirEntry = destFileList.find(function(elem){ return elem.path == filePath });

    }
  });
}

function ensureTenantContainerExists(tenantInfo, env) {
  console.log("ensuring " + env + " container really exists...");
  return containerReallyExists(tenantInfo, env)
  .then( (exists) => {
    let containerId = tenantInfo.destContainerId;
    let apiHelper = destApiHelper;
    let dbSession = destDbSession;
    if(env == 'src') { containerId = tenantInfo.containerId; apiHelper = srcApiHelper; dbSession = srcDbSession;}
    console.log("exists: %o, containerId: %o", exists, containerId);
    if(!exists || !containerId) {
      console.log("tenantId " + tenantInfo.tenantId + " not present on " + env + " dest blob, creating it\ntenantInfo = %o", tenantInfo);
      let path = 'blob/api/' + tenantInfo.tenantId + "/files/delete.me?createMissing=true";
      return apiHelper.put(path, '{please: "delete me"}',{headers:{'Content-Type':'application/octet-stream'}})
      .then( (response) => {
	//console.log("response for put " + path + ": %o", response);
	if(response.status == 202) {
	  console.log("tenant " + tenantInfo.tenantId + ": container created on " + env);
	  return dbSession.query("SELECT id FROM blob.TenantContainerMapping where tenantId = '" + tenantInfo.tenantId + "';")
	  .then( (result) => {
	    let newContainerId = result[0][0].id;
	    console.log("created container with id " + newContainerId);
	    return newContainerId;
	  })
	}
	else throw "Not able to create " + env + " container for tenant " + tenantInfo.tenantId + ", error: status is " + response.status;
      })
    }
    return Promise.resolve(containerId);
  });
}

function containerReallyExists(tenantInfo, env) {
  let apiHelper = destApiHelper;
  if(env == 'src') { apiHelper = srcApiHelper;}
  
  return apiHelper.get('blob/api/' + tenantInfo.tenantId + '/files/')
  .then( (response) => {
    console.log("container is there!");
    return true;
  })
  .catch( (err) => {
    console.log("container does not exist");
    return false;
  });
}

/**
 * initialize connection to target and src env
 */
function init() {
  return new EnvProxy().init(envInfo[srcEnv])
  .then( (proxy) => {
    srcEnvProxy = proxy;
    console.log("srcEnvProxy created");
  })
  .then( () => {
    return new EnvProxy().init(envInfo[destEnv]);
  })
  .catch( (err) => {
    console.log("error connecting to " + destEnv + ": %o", err);
    process.exit(1);
  })
  .then( (proxy) => {
    destEnvProxy = proxy;
    return new ApiHelper().init({instanceId: srcEnv, clientSecret: srcApiSecret, host: envInfo[srcEnv].public_hostname, password: srcApiPassword});
  })
  .then( (apiHelper) => {
    srcApiHelper = apiHelper;
    return new ApiHelper().init({instanceId: destEnv, clientSecret: destApiSecret, host: envInfo[destEnv].public_hostname, password: destApiPassword, http: {httpsAgent: new https.Agent({rejectUnauthorized: false})}});
  })
  .then( (apiHelper) => {
    destApiHelper = apiHelper;
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


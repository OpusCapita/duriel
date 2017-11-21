var ApiHelper = require('./ApiHelper.js');
var EnvProxy = require('./EnvProxy.js');
var mysql = require('mysql2/promise');
var envInfo = require('./envInfo.js');

if(!process.env.oidc_secret) {
  console.log("oidc_secret env var not set!");
  process.exit(1);
}

var srcApiHelper;
var destApiHelper;

var destEnvProxy;
var srcEnvProxy;

var dbSession;
  
// now start doing things
new EnvProxy().init(envInfo.develop)
.then( (proxy) => {
  srcEnvProxy = proxy;
  console.log("srcEnvProxy created");
})
.then( () => {
  return destEnvProxy = new EnvProxy().init(envInfo.pr2);
})
.catch( (err) => {
  console.log("error connecting to " + destEnv + ": %o", err);
  process.exit(1);
})
.then( () => {
  return srcApiHelper = new ApiHelper().init({clientSecret: process.env.oidc_secret});
})
.then( () => {
  return mysql.createConnection({
    host: 'localhost',
    port: srcEnvProxy.proxyServers['mysql'].port,
    user: 'root',
    password: 'notSecureP455w0rd'
  });
})
.then( (conn) => {
  dbSession = conn;
  return dbSession.query('SELECT tenantId, id FROM blob.TenantContainerMapping;');
})
.then( (result) => {
  var rows = result[0];
  console.log("rows = " + JSON.stringify(rows));
  for(var i = 0; i < rows.length; i++) {
    console.log("row " + i + " %o", rows[i]);
  }
  console.log('yeah baby!');
}).catch( (err) => {
  console.log('Error: ' + err);
});




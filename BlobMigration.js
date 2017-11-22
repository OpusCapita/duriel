const ApiHelper = require('./ApiHelper.js');
const EnvProxy = require('./EnvProxy.js');
const mysql = require('mysql2/promise');
const envInfo = require('./envInfo.js');

if (process.argv.length < 4) {
    console.log("missing command line args");
    printUsage();
}

function printUsage() {
    console.log("node BlobMigration.js :srcEnv :targetEnv");
    process.exit(1);
}

const srcEnv = process.argv[2];
const destEnv = process.argv[3];

if (!process.env.oidc_secret) {
    console.log("oidc_secret env var not set!");
    process.exit(1);
}

let srcApiHelper;
let destApiHelper;

let destEnvProxy;
let srcEnvProxy;

let srcDbSession;
let destDbSession;
const srcDbSecretEnv = 'SECRET_' + srcEnv + '_MYSQL';
const srcDbPassword = process.env[srcDbSecretEnv];
console.log('srcDbPassword = "' + srcDbPassword + '"');
if (!srcDbPassword) {
    console.log("required env %s is not set!", srcDbSecretEnv);
    process.exit(1);
}
let destDbSecretEnv = 'SECRET_' + destEnv + '_MYSQL';
let destDbPassword = process.env[destDbSecretEnv];
if (!destDbPassword) {
    console.log("required env %s is not set!", destDbSecretEnv);
    process.exit(1);
}

init()
    .then(() => {
        return srcDbSession.query('SELECT tenantId, id FROM blob.TenantContainerMapping;');
    })
    .then((result) => {
        const rows = result[0];
        console.log("rows = " + JSON.stringify(rows));
        for (let i = 0; i < rows.length; i++) {
            console.log("row " + i + " %o", rows[i]);
        }
        console.log('yeah baby!');
    }).catch((err) => {
    console.log('Error: ' + err);
});

/**
 * initialize connection to target and src env
 */
function init() {
    return new EnvProxy().init(envInfo.develop)
        .then((proxy) => {
            srcEnvProxy = proxy;
            console.log("srcEnvProxy created");
        })
        .then(() => {
            return destEnvProxy = new EnvProxy().init(envInfo.pr2);
        })
        .catch((err) => {
            console.log("error connecting to " + destEnv + ": %o", err);
            process.exit(1);
        })
        .then(() => {
            return srcApiHelper = new ApiHelper().init({clientSecret: process.env.oidc_secret});
        })
        .then(() => {
            return mysql.createConnection({
                host: 'localhost',
                port: srcEnvProxy.proxyServers['mysql'].port,
                user: 'root',
                password: srcDbPassword
            });
        })
        .then((conn) => {
            srcDbSession = conn;
            return mysql.createConnection({
                host: 'localhost',
                port: destEnvProxy.proxyServers['mysql'].port,
                user: 'root',
                password: destDbPassword
            });
        })
        .then((conn) => {
            destDbSession = conn;
            return Promise.resolve("done");
        })
        .catch((err) => {
            console.log("error: %o", err);
        });
}

init()
    .then(() => {
        return srcDbSession.query('SELECT tenantId, id FROM blob.TenantContainerMapping;');
})
    .then((result) => {
        const rows = result[0];
        console.log("rows = " + JSON.stringify(rows));
        for (let i = 0; i < rows.length; i++) {
            console.log("row " + i + " %o", rows[i]);
        }
        console.log('yeah baby!');
    }).catch((err) => {
    console.log('Error: ' + err);
});


/**
 * Syncs src blob store to target blob store recursively.
 * It won't overwrite files in case hashcode is matching.
 *
 * run: node BlobMigration.js srcEnv targetEnv
 * @module
 */
const ApiHelper = require('./ApiHelper.js');
const EnvProxy = require('../../EnvProxy.js');
const mysql = require('mysql2/promise');
const envInfo = require('../../envInfo.js');
const https = require('https');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const fs_open = Promise.promisify(require('fs').open);

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

const srcApiSecretEnv = 'SECRET_' + srcEnv + '_oidcCLIENT';
const destApiSecretEnv = 'SECRET_' + destEnv + '_oidcCLIENT';
if (!process.env[srcApiSecretEnv]) {
    console.log("env var " + srcApiSecretEnv + " not set!");
    process.exit(1);
}
if (!process.env[destApiSecretEnv]) {
    console.log("env var " + destApiSecretEnv + " not set!");
    process.exit(1);
}

const srcApiPasswordEnv = 'SECRET_' + srcEnv + '_USERPASS';
const destApiPasswordEnv = 'SECRET_' + destEnv + '_USERPASS';
if (!process.env[srcApiPasswordEnv]) {
    console.log("env var " + srcApiPasswordEnv + " not set!");
    process.exit(1);
}
if (!process.env[destApiPasswordEnv]) {
    console.log("env var " + destApiPasswordEnv + " not set!");
    process.exit(1);
}

const srcApiSecret = process.env[srcApiSecretEnv];
const destApiSecret = process.env[destApiSecretEnv];
const srcApiPassword = process.env[srcApiPasswordEnv];
const destApiPassword = process.env[destApiPasswordEnv];

let srcApiHelper;
let destApiHelper;

let destEnvProxy;
let srcEnvProxy;

let srcDbSession;
let destDbSession;
const srcDbSecretEnv = 'SECRET_' + srcEnv + '_MYSQL';
const srcDbPassword = process.env[srcDbSecretEnv];
if (!srcDbPassword) {
    console.log("required env %s is not set!", srcDbSecretEnv);
    process.exit(1);
}
const destDbSecretEnv = 'SECRET_' + destEnv + '_MYSQL';
const destDbPassword = process.env[destDbSecretEnv];
if (!destDbPassword) {
    console.log("required env %s is not set!", destDbSecretEnv);
    process.exit(1);
}

init().
    then(() => {
        return srcDbSession.query('SELECT tenantId, id FROM blob.TenantContainerMapping;');
    }).
    then((result) => {
        const rows = result[0];
        console.log('srcDbPassword = "' + srcDbPassword + '"');
        return Promise.all([rows, destDbSession.query('SELECT tenantId, id FROM blob.TenantContainerMapping;')]);
    }).
    then(([srcRows, result]) => {
        const destRows = result[0];
        const srcContainerMap = {};
        const destContainerMap = {};

        // now we need to iterate and compare the two sets
        for (let i = 0; i < destRows.length; i++) {
            destContainerMap[destRows[i].tenantId] = destRows[i].id;
        }

        return (function loop(i) {
            console.log("called loop(" + i + ")");
            if (i < srcRows.length) {
                const tenantId = srcRows[i].tenantId;
                const tenantInfo = srcContainerMap[tenantId] = { containerId: srcRows[i].id,
                    destContainerId: destContainerMap[tenantId],
                    tenantId: tenantId };
                console.log("tenant " + tenantId + ": \nsrcContainer " +
                  srcContainerMap[tenantId].containerId +
                  "\ndestContainer " + srcContainerMap[tenantId].destContainerId);
                return handleTenant(tenantInfo).
                    catch((err) => {
                        console.log(err);
                        process.exit(1);
                    }).
                    then(() => { return loop(i + 1); });
            }
            return Promise.resolve(null);
        }(0));
    }).
    catch((err) => {
        console.log('Error: ', err);
    });

function handleTenant(tenantInfo) {
    return ensureTenantContainerExists(tenantInfo, 'dest', 'files').
        then((destContainerId) => {
            // now synch the files
            tenantInfo.destContainerId = destContainerId;
            return ensureTenantContainerExists(tenantInfo, 'src', 'files');
        }).
        then(() => {
            return syncDirectory(tenantInfo, 'files', '/public/');
        }).
        then(() => {
            return syncDirectory(tenantInfo, 'files', '/private/');
        }).
        then(() => {
            return ensureTenantContainerExists(tenantInfo, 'dest', 'data');
        }).
        then((destContainerId) => {
            // now synch the files
            tenantInfo.destContainerId = destContainerId;
            return ensureTenantContainerExists(tenantInfo, 'src', 'data');
        }).
        then(() => {
            return syncDirectory(tenantInfo, 'data', '/public/');
        }).
        then(() => {
            return syncDirectory(tenantInfo, 'data', '/private/');
        })
}

function syncFile(tenantInfo, type, path) {
    console.log("syncing directory " + path + " for tenant " + tenantInfo.tenantId);
    return srcApiHelper.get('blob/api/' + tenantInfo.tenantId + '/' + type + path, { responseType: 'stream' }).
        then((response) => {
            let fsObj = response.headers['x-file-info'];
            if (!fsObj) {
                console.log("no fileObj in response\nresponse data: %o", response.headers);
                process.exit(1);
            }
            fsObj = JSON.parse(fsObj);
            return destApiHelper.put('blob/api/' + tenantInfo.tenantId + '/' + type + path + '?createMissing=true', response.data, { headers: { "Content-Type": "application/octet-stream" } })
        })
}

function syncDirectory(tenantInfo, type, path) {
    console.log("syncing directory " + type + path + " for tenant " + tenantInfo.tenantId);
    return srcApiHelper.get('blob/api/' + tenantInfo.tenantId + '/' + type + path).
        then((response) => {
            console.log("going to sync " + response.data.length + " files from src to dest");
            return destApiHelper.get('blob/api/' + tenantInfo.tenantId + '/' + type + path).
                then((destResponse) => {
                    return [response.data, destResponse.data];
                }).
                catch((err) => {
                    console.log("error reading dest dir: ", err);
                    return [response.data, null];
                })
        }).
        then(([srcFileList, destFileList]) => {
            return (function fileloop(i) {
                console.log("called file loop(" + i + ")");
                if (i < srcFileList.length) {
                    console.log('srcFile ' + srcFileList[i].path + ", size " + srcFileList[i].size + ", isDir = " + srcFileList[i].isDirectory);
                    const srcDirEntry = srcFileList[i];
                    let filePath = srcDirEntry.path;
                    let destDirEntry = null;
                    if (destFileList) {destDirEntry = destFileList.find(function(elem) { return elem.path == filePath });}
                    let p = null;
                    if (srcDirEntry.isDirectory) {
	  if (!filePath.endsWith('/')) {filePath += '/';}
	  p = syncDirectory(tenantInfo, type, filePath);
                    } else if (destDirEntry && srcDirEntry.checksum == destDirEntry.checksum) {
	  console.log("src and dest have same checksum, skipping file sync for " + filePath);
	  p = Promise.resolve(null);
                    } else {p = syncFile(tenantInfo, type, filePath);}

                    return p.
                        then(() => { return fileloop(i + 1); });
                }
                return Promise.resolve(null);
            }(0));
        });
}

function ensureTenantContainerExists(tenantInfo, env, type) {
    console.log("ensuring " + env + " container of type " + type + " really exists...");
    return containerReallyExists(tenantInfo, env, type).
        then((exists) => {
            let containerId = tenantInfo.destContainerId;
            let apiHelper = destApiHelper;
            let dbSession = destDbSession;
            if (env == 'src') { containerId = tenantInfo.containerId; apiHelper = srcApiHelper; dbSession = srcDbSession;}
            console.log("exists: %o, containerId: %o", exists, containerId);
            if (!exists || !containerId) {
                console.log("" + type + " container for tenantId " + tenantInfo.tenantId + " not present on " + env + " dest blob, creating it\ntenantInfo = %o", tenantInfo);
                const path = 'blob/api/' + tenantInfo.tenantId + "/" + type + "/delete.me?createMissing=true";
                return apiHelper.put(path, '{please: "delete me"}', { headers: { 'Content-Type': 'application/octet-stream' } }).
                    then((response) => {
                        // console.log("response for put " + path + ": %o", response);
                        if (response.status == 202) {
	  console.log("tenant " + tenantInfo.tenantId + ": container created on " + env);
                            let query = "SELECT id FROM blob.TenantContainerMapping where tenantId = '" + tenantInfo.tenantId + "'";
                            if (type != "files") {
                                query += " AND id LIKE '%-" + type + "'";
                            }
                            query += ";"
                            console.log("querying: \n" + query);
	  return dbSession.query(query).
	  then((result) => {
	    const newContainerId = result[0][0].id;
	    console.log("created container with id " + newContainerId);
	    return newContainerId;
	  })
                        } else {throw "Not able to create " + env + " container for tenant " + tenantInfo.tenantId + "and type " + type + ", error: status is " + response.status;}
                    })
            }
            return Promise.resolve(containerId);
        });
}

function containerReallyExists(tenantInfo, env, type) {
    let apiHelper = destApiHelper;
    if (env == 'src') { apiHelper = srcApiHelper;}

    return apiHelper.get('blob/api/' + tenantInfo.tenantId + '/' + type + '/').
        then((response) => {
            console.log("" + type + " container is there!");
            return true;
        }).
        catch((err) => {
            console.log("" + type + " container does not exist");
            return false;
        });
}

/**
 * initialize connection to target and src env
 */
function init() {
    console.log("envInfo[srcEnv]= %o", envInfo[srcEnv]);
    return new EnvProxy().init(envInfo[srcEnv]).
        then((proxy) => {
            srcEnvProxy = proxy;
            console.log("srcEnvProxy created");
        }).
        catch((err) => {
            console.log("error connecting to " + srcEnv + ": %o", err);
            process.exit(1);
        }).
        then(() => {
            return new EnvProxy().init(envInfo[destEnv]);
        }).
        catch((err) => {
            console.log("error connecting to " + destEnv + ": %o", err);
            process.exit(1);
        }).
        then((proxy) => {
            destEnvProxy = proxy;
            return new ApiHelper().init({ instanceId: srcEnv, clientSecret: srcApiSecret, host: envInfo[srcEnv].public_hostname, password: srcApiPassword, http: { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } });
        }).
        then((apiHelper) => {
            srcApiHelper = apiHelper;
            return new ApiHelper().init({ instanceId: destEnv, clientSecret: destApiSecret, host: envInfo[destEnv].public_hostname, password: destApiPassword, http: { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } });
        }).
        then((apiHelper) => {
            destApiHelper = apiHelper;
            return mysql.createConnection({
                host: 'localhost',
                port: srcEnvProxy.proxyServers['mysql'].port,
                user: 'root',
                password: srcDbPassword
            });
        }).
        then((conn) => {
            srcDbSession = conn;
            return mysql.createConnection({
                host: 'localhost',
                port: destEnvProxy.proxyServers['mysql'].port,
                user: 'root',
                password: destDbPassword
            });
        }).
        then((conn) => {
            destDbSession = conn;
            return Promise.resolve("done");
        }).
        catch((err) => {
            console.log("error: %o", err);
            throw err;
        });
}


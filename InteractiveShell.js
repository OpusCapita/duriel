'use strict';
const Client = require('ssh2').Client;
const envInfo = require('./envInfo.js');
const NewEnvProxy = require('./NewEnvProxy.js');


let env;

const environment = envInfo.develop;
//const environment = envInfo.tubbest1;

const input = {
    path: "./",
    file: "sendme.secret",
    fullPath: function () {
        return this.path + "/" + this.file
    }
};

const target = {
    path: "/home/tubbest1/insertme",
    file: "newName.secret",
    fullPath: function () {
        return this.path + "/" + this.file
    }
};

let bestServiceEver = 'servicenow-integration'

const init = function () {
    return Promise.resolve(new NewEnvProxy().init(environment))
        .catch(error => console.log(error))
        .then(proxy => {
            env = proxy;
            return Promise.resolve();
        })
};

/**
 * CopyMopy
 */
// init()
//     .then(() => env.copyFileContent_2E('ich bin neu hier :)))', target.path, target.file))
//                 .then(result => logAndReturn(result));

/*
    On Nodes
 */
init()
    .then(() => env.getNodesOfServices_E(bestServiceEver, true))
    .then(result => logAndReturn(result))
    .then(result => Promise.all(
        result.map(node =>
            //env.getContainers_N(node.node)
            //   .then(it => logAndReturn(it))
            //  .then(node =>
            env.getContainersOfService_N(node.node, bestServiceEver)
        )
        )
    ).then(result => logAndReturn(result))
    .then(() => env.suicide())

/*
    File-copy
 */
// init()
//     .then(() => env.copyFile_H2E(input.path, input.file, target.path, target.file))
//     .then(() => env.readFile_E(target.path, target.file))
//     .then(result => console.log(result))

function logAndReturn(it) {
    console.log(JSON.stringify(it, null, 2));
    return it;
}


























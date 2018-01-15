'use strict';
const Client = require('ssh2').Client;
const envInfo = require('./envInfo.js');
const EnvProxy = require('./EnvProxy.js');


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

let bestServiceEver = 'servicenow-integration';

const init = function () {
    return Promise.resolve(new EnvProxy().init(environment))
        .catch(error => console.log(error))
        .then(proxy => {
            env = proxy;
            return Promise.resolve();
        })
};

const consul_data_path = "/consul/data";
const consul_script_path = "/consul/data/scripts";
const consil_script_file = 'disc_check';

//
// init()
//     .then(() => env.changePermission_E(consul_data_path, '777', true) )
//     .then(() => env.copyFileContent_2E("df -h \nexit(0)", consul_script_path, consil_script_file))
//     .then(() => env.executeCommand_E(`chmod 755 ${consul_data_path}`, true))
//     .then(response => logAndReturn(response))
//     .then(() => env.changePermission_E([consul_script_path, consil_script_file].join('/'), '+x', true))
//     .then(() => env.changePermission_E(consul_data_path, '755', true))
//     .then(response => logAndReturn(response))
//     .then(() => env.close());


/**
 * CopyMopy
 */
// init()
//     .then(() => env.copyFileContent_2E('ich bin neu hier :)))', target.path, target.file))
//                 .then(result => logAndReturn(result));

//
init()
    .then(() => env.getContainers_L())
    .then(it => logAndReturn(it))
    .then(() => env.close());

/*
    On Nodes
 */
// init()
//     .then(() => env.getTasksOfServices_E(bestServiceEver, true))
//     .then(result => logAndReturn(result))
//     .then(result => Promise.all(
//         result.map(task => {
//             return env.copyFile_L2N(task.node,input.path, input.file, target.path, target.file)
//                 .then(() => env.changePermission_N(task.node, target.fullPath(), '+x', true))
//         })
//         )
//     ).then(result => logAndReturn(result))
//     .then(() => env.close());

/*
    File-copy
 */
// init()
//     .then(() => env.copyFile_L2E(input.path, input.file, target.path, target.file))
//     .then(() => env.readFile_E(target.path, target.file))
//     .then(result => console.log(result))

function logAndReturn(it) {
    console.log(JSON.stringify(it, null, 2));
    return it;
}


























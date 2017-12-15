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


const init = function () {
    return Promise.resolve(new NewEnvProxy().init(environment))
        .catch(error => console.log(error))
        .then(proxy => {
            env = proxy;
            return Promise.resolve();
        })
};

init().then(() => env.getNodesOfServices_E('servicenow-integration', true))
    .then(result => console.log(result));














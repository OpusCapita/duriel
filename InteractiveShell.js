'use strict';
const Client = require('ssh2').Client;
const envInfo = require('./envInfo.js');
const EnvProxy = require('./EnvProxy.js');


let srcEnvProxy;

// const environment = envInfo.develop;
 const environment = envInfo.tubbest1;

const init = function () {
    return Promise.resolve(new EnvProxy().init(environment))
        .catch(error => console.log(error))
        .then(proxy => {
            srcEnvProxy = proxy;
            return Promise.resolve();
        })
};

init()
    // .then(() => srcEnvProxy.transmitFile("./", "sendme.secret", "/home/tubbest1/insertme", "newName.secret"))
    // .then(() => srcEnvProxy.getAllDockerContainers())
    // .then(containers => console.log(containers))
    // .then(() => srcEnvProxy.executeCommand("docker exec -it andarielmonitoring_consul_1 sh"))
    // .then(response => console.log(response))
    // .then(() => srcEnvProxy.executeCommand("ls -la"))
    // .then(response => console.log(response))
    // .catch(error => console.log(error))
    .then(() => Promise.resolve());

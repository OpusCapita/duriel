'use strict';
const Client = require('ssh2').Client;
const envInfo = require('./envInfo.js');
const EnvProxy = require('./EnvProxy.js');


let srcEnvProxy;

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
    .then( () => srcEnvProxy.transmitFile("./", "sendme.secret", "/home/tubbest1/insertme", "newName.secret"))
    .then( () => srcEnvProxy.getDockerContainers())
    .then((containers) => console.log(containers))
    .catch(error => console.log(error));


// let conn = new Client();
// conn.on('ready', function() {
//     console.log('Client :: ready');
//     conn.shell(function(err, stream) {
//         if (err) throw err;
//         stream.on('close', function() {
//             console.log('Stream :: close');
//             conn.end();
//         }).on('data', function(data) {
//             console.log('STDOUT: ' + data);
//         }).stderr.on('data', function(data) {
//             console.log('STDERR: ' + data);
//         });
//         stream.end('ls -l\nexit\n');
//     });
// }).connect({
//     host: '13.80.25.111',
//     port: 22,
//     username: 'tubbest1',
//     privateKey: require('fs').readFileSync('/home/tubbest1/.ssh/RsaPrivKeyST.ppk')
// });
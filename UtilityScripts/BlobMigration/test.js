const dns = require('dns');
const ApiHelper = require('./ApiHelper.js');

const ssh_config = {
    host: 'bnp-admin-pr2.westeurope.cloudapp.azure.com',
    port: 2200,
    username: 'gr4per',
    agentForward: true,
    agent: process.env.SSH_AUTH_SOCK
};

new ApiHelper().init({ clientSecret: '91c0fabd17a9db3cfe53f28a10728e39b7724e234ecd78dba1fb05b909fb4ed98c476afc50a634d52808ad3cb2ea744bc8c3b45b7149ec459b5c416a6e8db242' }).
    then(() => {
        console.log('api client initialized');
    });


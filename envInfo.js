const extend = require('extend');

let default_config = {
    public_port: 443,
    public_scheme: 'https',
    logstash_ip: '172.17.0.1',
    admin_port: 2200
};


module.exports.dev1 = extend(true, {}, default_config, {
    admin_user: 'tubbest1',
    public_ip: '104.40.214.31',
    admin_address: '23.97.194.167',
    public_hostname: 'bnp-dev1.westeurope.cloudapp.azure.com'
});

module.exports.develop = extend(true, {}, default_config, {
    admin_user: 'duriel-dev',
    public_ip: '13.95.208.44',
    admin_address: 'bnp-admin-develop.westeurope.cloudapp.azure.com',
    public_hostname: 'develop.businessnetwork.opuscapita.com'
});

module.exports.stage = extend(true, {}, default_config, {
    admin_user: 'dmm',
    public_ip: '13.81.248.126',
    admin_address: '40.115.62.92',
    public_hostname: 'stage.businessnetwork.opuscapita.com'
});

module.exports.prod = extend(true, {}, default_config, {
    admin_user: 'dmm',
    public_ip: '13.81.203.28',
    admin_address: 'bnp-admin-pr2.westeurope.cloudapp.azure.com',
    public_hostname: 'businessnetwork.opuscapita.com'
});

module.exports.pr2 = extend(true, {}, default_config, {
    admin_user: 'dmm',
    public_ip: '13.80.124.58',
    admin_address: 'bnp-admin-pr2.westeurope.cloudapp.azure.com',
    public_hostname: 'inactive-bnp-prod2.westeurope.cloudapp.azure.com'
});

module.exports.tubbest1 = extend(true, {}, default_config, {
    admin_address: 'bndevboxes.westeurope.cloudapp.azure.com',
    admin_port: 2201,
    admin_user: 'tubbest1'
});
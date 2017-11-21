var extend = require('extend');

var default_config = {
  public_port: 443,
  public_scheme: 'https',
  logstash_ip: '172.17.0.1',
  admin_port: 2200
}
 

module.exports.develop = extend(true, {}, default_config, {
  admin_user: 'dm',
  public_ip: '104.40.214.31',
  admin_address: '13.80.22.170',
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
  admin_address: this.public_ip,
  public_hostname: 'businessnetwork.opuscapita.com'
});

module.exports.pr2 = extend(true, {}, default_config, {
  admin_user: 'dmm',
  public_ip: '13.80.124.58',
  admin_address: 'bnp-admin-pr2.westeurope.cloudapp.azure.com',
  public_hostname: 'businessnetwork.opuscapita.com'
});

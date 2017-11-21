var http = require('axios');
var extend = require('extend');
var qs = require('qs');

var defaultConfig = { username: 'ocadmin',
               password: 'test',
               scheme: 'https',
               host: 'develop.businessnetwork.opuscapita.com',
               port: '443',
               clientId: 'oidcCLIENT'
             }

/** 
 * Takes the configuration and initializes a new API session, then
 * stores the access token for subsequent requests
 */
module.exports = class ApiHelper {
  constructor() {
  }

  init(overrideConfig) {
    this.config = extend(true, {}, defaultConfig, overrideConfig);

    var data = qs.stringify( {'grant_type': 'password',
                              'username': this.config.username,
                              'password': this.config.password,
                              'scope': 'email phone userInfo roles'
                             });

    var tokenUrl = this.config.scheme + "://" + this.config.host + ":" + this.config.port + "/auth/token"; 

    return http.post(tokenUrl, 
                     data,
                     { auth: { username: this.config.clientId, password: this.config.clientSecret}} 
    ).then( (response) => {
      console.log("received response for " + tokenUrl + ": " + response.status);
      this.tokenInfo = response.data; 
      this.tokenInfo.expires_at = new Date(this.tokenInfo.expires_in *1000 + new Date().getTime()).getTime();
      //console.log("response: %o", this.tokenInfo);
      console.log("received access_token, valid until %o", new Date(this.tokenInfo.expires_at));
    })
    .catch( (err) => {
      console.log("Error getting access token: %o", err);
    });
  }

  ensureSession() {
    if (!this.tokenInfo) {
     return Promise.reject('ApiHelper not initialized! Call init(config) first...');
    }
    if(new Date().getTime() > this.tokenInfo.expires_at - 5000) {
      console.log("refreshing token which is valid until %o", new Date(this.tokenInfo.expires_at));
      return this.init({});
    }
    return Promise.resolve();
  }

  getAuthHeader() {
    return this.tokenInfo.token_type + ": " + this.tokenInfo.access_token;
  }
}  

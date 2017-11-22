var axios = require('axios');
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
 *
 */
module.exports = class ApiHelper {
  
  constructor() {
  }

  init(overrideConfig) {
    this.config = extend(true, {}, defaultConfig, overrideConfig);

    this.http = axios.create(extend(true, {}, this.config.http));

    var data = qs.stringify( {'grant_type': 'password',
                              'username': this.config.username,
                              'password': this.config.password,
                              'scope': 'email phone userInfo roles'
                             });

    var tokenUrl = this.config.scheme + "://" + this.config.host + ":" + this.config.port + "/auth/token"; 

    return this.http.post(tokenUrl, 
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
      throw err;
    });
  }

  /**
   * Makes sure we have a valid access_token and returns a Promise on the 
   * Auth header value to be used for authenticating API calls
   */
  ensureSession() {
    if (!this.tokenInfo) {
     return Promise.reject('ApiHelper not initialized! Call init(config) first...');
    }
    if(new Date().getTime() > this.tokenInfo.expires_at - 5000) {
      console.log("refreshing token which is valid until %o", new Date(this.tokenInfo.expires_at));
      return this.init({});
    }
    return Promise.resolve(this.getAuthHeader());
  }

  getAuthHeader() {
    return this.tokenInfo.token_type + ": " + this.tokenInfo.access_token;
  }

  /**
   * Wrapper around axios put, will take care of API session handling
   * and schema host, port. 
   * For usage just start uri with serviceName, e.g. blob/api/c_ncc/files/some/file
   * returns a Promise on the response
   */
  put(uri, data, config) {
    return ensureSession()
    .then(this.http.put(this.config.scheme + "://" + this.config.host + ":" + this.config.port + "/" + uri, data, config));
  }
  
  /**
   * Wrapper around axios get, will take care of API session handling
   * and schema host, port. 
   * For usage just start uri with serviceName, e.g. blob/api/c_ncc/files/some/file
   * returns a Promise on the response
   */
  get(uri, config) {
    return ensureSession()
    .then(this.http.get(this.config.scheme + "://" + this.config.host + ":" + this.config.port + "/" + uri, config));
  }
}  

var Promise = require('bluebird');
var dns = require('dns');
var net = require('net');
var Client = require('ssh2').Client;
var axios = require('axios');

var ssh_config = {
  host: 'bnp-admin-pr2.westeurope.cloudapp.azure.com',
  port: 2200,
  username: 'gr4per',
  agentForward: true,
  agent: process.env.SSH_AUTH_SOCK
}

/** 
 * Should return a promise on an EnvProxy instance
 */
module.exports = class EnvProxy {

  constructor() {
    this.proxyServers = {};
  }

  init(config){
    
    this.sshconn = new Client();
    var initSsh = new Promise( (resolve, reject) => {
      this.sshconn.on('ready', (err) => {
	console.log("ssh connection to " + ssh_config.host + " established");
	resolve(this.sshconn);
      });
      this.sshconn.on('error', function(err) {
	reject(err);
      }); 
      this.sshconn.connect(ssh_config);
    });

    return initSsh
    .then( () => {
	return this.createProxiedTunnel('consul', 'localhost',8500)
      }
    )
    .then( () => {
	return this.lookupService('mysql');
      }
    )
    .then( ([ip, port]) => {
	return this.createProxiedTunnel('mysql', ip, port)
      }
    )
    .then( () => {
      return this;
    })
    .catch( (err) => {
      console.log("init error: %o", err);
    });
  }

  /**
   * finds mysql ip on target env
   * returns promise on an array like [ip,port]
   */
  lookupService(serviceName) {
    console.log("looking up service " + serviceName + "...");
    return this.queryConsul('/v1/catalog/service/' + serviceName)
    .then((data) => {
      console.log(serviceName + ' looked up: ' + data[0].Address);
      return Promise.resolve([data[0].Address, data[0].ServicePort]);
    })
    .catch(error => {
      console.log("error looking up " + serviceName);
      console.log(error);
      throw error;
    });
  }

  /** 
   * returns json response from consul
   */ 
  queryConsul(apiCall) {
    var proxy = this.proxyServers['consul'];
    if(!proxy) return Promise.reject('no proxy for consul found!');
    return axios.get('http://localhost:' + proxy.port + apiCall)
    .then((response) => {
      return Promise.resolve(response.data);
    })
    .catch(error => {
      console.log("error making http call to tunneled consul");
      return Promise.reject(error);
    });
  }

  /** 
   * Creates a local server socket on any free port and tunnels it to requested target host / port
   * The proxy info is stored in proxyServers under proxyKey and has members
   * key = it's proxyKey
   * server = the net.server holding the socket and accept handler
   * port = the proxy porti
   * Returns a promise on a ready to use proxy instance
   */
  createProxiedTunnel(proxyKey, targetHostName, targetPort) {
    console.log("creating proxy " + proxyKey + " pointing to " + targetHostName + ":" + targetPort + "...");
    var proxy = {};
    proxy.key=proxyKey;
    this.proxyServers[proxyKey] = proxy;

    proxy.server = net.createServer( (conn) =>  {
      console.log("proxySrv for " + targetHostName + ":" + targetPort + " handling client request, remote port = " + conn.remotePort);
      conn.on('end', () => {
	console.log('proxySrv client disconnected from socket');
      });
      conn.on('close', () => {
	console.log('proxySrv client socket closed');
      });

      console.log("connecting client to proxyStream, remote address " + conn.remoteAddress + ", remote port " + conn.remotePort);

      this.sshconn.forwardOut('localhost',
		      this.proxyServers[proxyKey].port,
		      targetHostName,
		      targetPort,
		      (err, stream) => {
	if (err) {
	  console.log("forwarding failed: " + err);
	  this.sshconn.end();
	}
	else {
	  console.log("proxy forwarding via ssh, piping stream to socket");
	  stream.on('end', function(msg) {
	    console.log('stream end event on proxyStream ' + msg);
	  });
	  this.sshconn.on('close', () => {
	    console.log("sshconn stream closing");
	  });
	  stream.pipe(conn);
	  conn.pipe(stream);
	}
      });
      console.log("client " + conn.remotePort + " attached to " + proxyKey + " proxyStream");
    });

    proxy.server.maxConnections = 1;
    proxy.server.on('error', (err) => {
      console.log(proxyKey + "proxy server error : " + err);
    });

    return new Promise(function(resolve, reject) {
      proxy.server.listen(0, (err) => {
        if(err) {
          console.log(proxyKey + "proxy server listen failed: " + err);
          reject(err);
        }
        proxy.port = proxy.server.address().port;
        console.log(proxyKey + 'proxy server bound to ' + proxy.port);
        resolve(proxy);
      });
    });
  }
}

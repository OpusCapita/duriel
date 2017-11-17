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

var mysqlHostname = 'dev-mysql0';
var mysqlIp;

var consulStream;
var consulData = '';

var sshconn = new Client();
sshconn.on('ready', function() {
  console.log("ssh connection to " + ssh_config.host + " established");
  connectConsul();
});
sshconn.connect(ssh_config);

function queryConsul(apiCall, callback) {
  if(!consulStream) {
    setTimeout(function() { queryConsul(apiCall, callback); }, 100);
    console.log("retrying query later");
  }
  else { 
    consulStream.on('end', () => {
      callback();
      consulData = '';
    });
    consulStream.write('GET ' + apiCall + ' HTTP/1.1\nHost: localhost\n\n');
  }
}

function lookupMysql() {
  axios.get('http://localhost:' + consulPort + '/v1/catalog/service/mysql')
  .then((response) => {
    console.log('mysql looked up: ' + JSON.stringify(response.data));
    mysqlIp = response.data[0].Address;
    console.log('mysqlIp = ' + mysqlIp);
    connectMysql();
  })
  .catch(error => {
    console.log("error making http call to tunneled consul");
    console.log(error);
  });
}

var mysqlSrv;
var mysqlPort;
function connectMysql() {
  mysqlSrv = net.createServer( (conn) =>  {
    console.log("handling client request, remote port = " + conn.remotePort);
    conn.on('end', () => {
      console.log('mysql client disconnected from socket');
    });
    conn.on('close', () => {
      console.log('mysql client socket closed');
    });
    
    console.log("connecting client to mysqlStream, remote address " + conn.remoteAddress + ", remote port " + conn.remotePort);

    sshconn.forwardOut('localhost',
		    3306,
		    mysqlIp,
		    3306,
		    function(err, stream) {
      if (err) {
	console.out("mysql forwarding failed: " + err);
	sshconn.end();
      }
      else {
	console.log("forwarding via ssh, piping stream to socket");
	stream.on('end', function(msg) {
	  console.log('stream end event on mysqlStream ' + msg);
	});
	sshconn.on('close', function() {
	  console.log("sshconn stream closing");
	});
	stream.pipe(conn);
	conn.pipe(stream);
      }
    });
    console.log("mysql client " + conn.remotePort + " attached to mysqlStream");
  });
  mysqlSrv.maxConnections = 1;
  mysqlSrv.on('error', (err) => {
    console.log("mysql server error : " + err);
  });

  mysqlSrv.listen(0, () => {
    mysqlPort = mysqlSrv.address().port;
    console.log('mysql server bound to ' + mysqlPort);
    //doSomething();
  });

}

var consulSrv;
var consulPort;
function connectConsul() {
  consulSrv = net.createServer( (conn) =>  {
    console.log("consulSrv handling client request, remote port = " + conn.remotePort);
    conn.on('end', () => {
      console.log('consul client disconnected from socket');
    });
    conn.on('close', () => {
      console.log('consul client socket closed');
    });

    console.log("connecting client to consulStream, remote address " + conn.remoteAddress + ", remote port " + conn.remotePort);

    sshconn.forwardOut('localhost',
		    consulPort,
		    'localhost',
		    8500,
		    function(err, stream) {
      if (err) {
	console.log("forwarding failed: " + err);
	sshconn.end();
      }
      else {
	console.log("consul forwarding via ssh, piping stream to socket");
	stream.on('end', function(msg) {
	  console.log('stream end event on consulStream ' + msg);
	});
	sshconn.on('close', function() {
	  console.log("sshconn stream closing");
	});
	stream.pipe(conn);
	conn.pipe(stream);
      }
    });
    console.log("client " + conn.remotePort + " attached to consulStream");
  });
  consulSrv.maxConnections = 1;
  consulSrv.on('error', (err) => {
    console.log("consul server error : " + err);
  });
  consulSrv.listen(0, () => {
    consulPort = consulSrv.address().port;
    console.log('consul server bound to ' + consulPort + ", trying to lookup mysql...");
    lookupMysql();
  });
}

function doSomething() {
  if(mysqlStream) {
    console.log("doing something with axios");
    axios.get('http://localhost:8500/v1/catalog/services')
    .then((response) => {
      console.log(response.data);
    })
    .catch(error => {
      console.log(error);
    });
  }
  else {
    console.log("mysqlStream not ready yet, waiting");
    setTimeout(doSomething, 100);
  
}
}
console.log('hello world!');

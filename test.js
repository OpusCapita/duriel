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
var mysqlStream;
var mysqlConn;
var mysqlServer;

var sshconn = new Client();
sshconn.on('ready', function() {
  console.log("ssh connection to " + ssh_config.host + " established");
});
var mysqlIp = dns.lookup(ssh_config.host, function() {
  console.log('looked up ' + ssh_config.host + " to be " + mysqlIp);
  sshconn.connect(ssh_config);
});

var srv = net.createServer( (conn) =>  {
  console.log("handling client request, remote port = " + conn.remotePort);
  if(mysqlConn) {
    console.log("rejecting, mysql conn already in use");
    conn.end();
    return;
  }
  conn.on('end', () => {
    console.log('client disconnectedi from socket, unpiping stream');
    mysqlStream.unpipe();
    mysqlStream.close();
    if(mysqlConn) mysqlConn.unpipe();
    mysqlConn = null;
    console.log("unpipe done");
  });
  conn.on('close', () => {
    console.log('client socket closed');
    mysqlStream.unpipe();
    if(mysqlConn) mysqlConn.unpipe();
    mysqlConn = null;
  });

  
  console.log("connecting client to mysqlStream, remote address " + conn.remoteAddress + ", remote port " + conn.remotePort + ", stream " + mysqlStream);

  sshconn.forwardOut('localhost',
                  8500,
                  '10.26.19.197',
                  8500,
                  function(err, stream) {
    if (err) {
      console.out("forwarding failed: " + err);
      sshconn.end();
    }
    else {
      console.log("forwarding via ssh, piping stream to socket");
      mysqlStream = stream;
      stream.on('end', function(msg) {
        console.log('stream end event on mysqlStream ' + msg);
      });
      sshconn.on('close', function() {
        console.log("sshconn stream closing");
        mysqlStream = null;
        if(mysqlConn)
          mysqlConn.end();
      });
      mysqlStream.pipe(conn);
      conn.pipe(mysqlStream);

    }

  });
  mysqlConn = conn;
  console.log("client " + conn.remotePort + " attached to mysqlStream");
});
srv.maxConnections = 1;
srv.on('error', (err) => {
  console.log("server error : " + err);
});

var serverPort= 8500;
srv.listen(serverPort, () => {
  console.log('server bound to ' + serverPort);
  //doSomething();
});

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

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

var srv = net.createServer( (conn) =>  {
  console.log("socket accept handler, creating new ssh connection to forward traffic");
  conn.on('end', () => {
    console.log('client disconnected');
  });

  var sshconn = new Client();
  sshconn.on('ready', function() {
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
        stream.pipe(conn);
        conn.pipe(stream);
        sshconn.on('close', function() {
          conn.end();
        }); 
      }
    });
  });
  sshconn.connect(ssh_config);
});

srv.on('error', (err) => {
  console.log("server error : " + err);
});

var serverPort= 8500;
srv.listen(serverPort, () => {
  console.log('server bound to ' + serverPort);
  doSomething();
});

function doSomething() {
  axios.get('http://localhost:8500/v1/catalog/services')
  .then((response) => {
    console.log(response.data);
  })
  .catch(error => {
    console.log(error);
  });
}
console.log('hello world!');

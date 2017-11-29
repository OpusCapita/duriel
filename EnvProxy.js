const Promise = require('bluebird');
const dns = require('dns');
const net = require('net');
const Client = require('ssh2').Client;
const axios = require('axios');
const fs = require('fs');

const EpicLogger = require('./EpicLogger');
const log = new EpicLogger();

let default_config = {};


/**
 * Should return a promise on an EnvProxy instance
 */
module.exports = class EnvProxy {

    constructor() {
        this.proxyServers = {};
    }

    init(overrideconfig) {
        this.config = Object.assign({}, default_config, overrideconfig);
        this.sshconn = new Client();
        let initSsh = new Promise((resolve, reject) => {
            this.sshconn.on('ready', (err) => {
                console.log("ssh connection to " + this.config.admin_address + " established");
                resolve(this.sshconn);
            });
            this.sshconn.on('error', function (err) {
                reject(err);
            });
            let ssh_config = {
                host: this.config.admin_address,
                port: this.config.admin_port,
                username: this.config.admin_user,
                agentForward: true,
                agent: process.env.SSH_AUTH_SOCK
            };

            console.log("connecting to %o", ssh_config);
            this.sshconn.connect(ssh_config);
        });

        return initSsh
            .then(() => {
                return this.createProxiedTunnel('consul', 'localhost', 8500)
            })
            .then(() => {
                return this.lookupService('mysql');
            })
            .then(([ip, port]) => {
                return this.createProxiedTunnel('mysql', ip, port)
            })
            .then(() => {
                return this;
            })
            .catch((err) => {
                console.log("init error: %o", err);
            });
    };

    transmitFile(inputPath, inputFileName, targetPath, targetFileName) {
        if (!targetFileName)
            targetFileName = inputFileName;
        const input = fs.readFileSync(`${inputPath}/${inputFileName}`);
        console.log("fileContent: %s", input);
        return this.createDir(targetPath)
            .then(_ => this.executeCommand(`echo '${input}' > ${targetPath}/${targetFileName}`));
    }

    getDockerContainers() {
        const splitter = /\s*;\s*/; // split and trim in one regex <3
        return this.executeCommand(" docker ps --format '{{.Names}};{{.Image}};{{.Command}}' --no-trunc")
            .then(response => {
                return response.split('\n').map(
                    row => {
                        return row.split(splitter);
                    }
                );
            })
    };

    executeCommand(command) {
        log.info(`command ${command}`);
        let response = "";
        return new Promise((resolve, reject) => {
            this.sshconn.exec(command, function (err, stream) {
                if (err) {
                    console.log('SECOND :: exec error: ' + err);
                    return reject(err);
                }
                stream.on('end', () => {
                    //console.log(response);
                    return resolve(response);
                }).on('data', function (data) {
                    response += data.toString();
                });
            });
        });
    };

    createDir(dir) {
        return this.executeCommand(`mkdir -p '${dir}'`);
    }

    /**
     * finds mysql ip on target env
     * returns promise on an array like [ip,port]
     */
    lookupService(serviceName) {
        console.log("looking up service " + serviceName + "...");
        return this.queryConsul('/v1/catalog/service/' + serviceName)
            .then(data => {
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
        const proxy = this.proxyServers['consul'];
        if (!proxy) return Promise.reject('no proxy for consul found!');
        return axios.get('http://localhost:' + proxy.port + apiCall)
            .then((response) => {
                return Promise.resolve(response.data);
            })
            .catch(error => {
                console.log("error making http call to tunneled consul");
                return Promise.reject(this.sshconn.e);
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
        const proxy = {};
        proxy.key = proxyKey;
        this.proxyServers[proxyKey] = proxy;

        proxy.server = net.createServer((conn) => {
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
                    } else {
                        console.log("proxy forwarding via ssh, piping stream to socket");
                        stream.on('end', function (msg) {
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

        return new Promise(function (resolve, reject) {
            proxy.server.listen(0, (err) => {
                if (err) {
                    console.log(proxyKey + "proxy server listen failed: " + err);
                    reject(err);
                }
                proxy.port = proxy.server.address().port;
                console.log(proxyKey + 'proxy server bound to ' + proxy.port);
                resolve(proxy);
            });
        });
    }
};

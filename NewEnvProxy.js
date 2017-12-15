const Promise = require('bluebird');
const dns = require('dns');
const net = require('net');
const Client = require('ssh2').Client;
const axios = require('axios');
const fs = require('fs');

const EpicLogger = require('./EpicLogger');
const log = new EpicLogger();

let default_config = {};

const semicolon_splitter = /\s*;\s*/; // split and trim in one regex <3
const comma_splitter = /\s*,\s*/;
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

    /**
     * returns a list containing all nodes running the service
     * @param serviceName
     * @param onlyRunning
     * @returns {PromiseLike<T>}
     */
    getNodesOfServices_E(serviceName, onlyRunning = false){
        return this.executeCommand_E(`docker service ps ${serviceName} --format '{{.ID}};{{.Name}};{{.Image}};{{.Node}};{{.DesiredState}};{{.CurrentState}};{{.Error}};{{.Ports}}' ${onlyRunning ? "-f 'desired-state=running'" : ""}`)
            .then(response => {
                return response.split('\n').map(
                    row => {
                        let split = row.split(semicolon_splitter);
                        if (split.length === 8) {
                            return {
                                id: split[0],
                                name: split[1],
                                image: split[2],
                                node: split[3],
                                desiredState: split[4],
                                currentState: split[5],
                                error: split[6],
                                ports: split[7].split(comma_splitter)
                            };
                        }
                    }
                );
            }).then(nodes => nodes.filter(it => it !== undefined))
    }

    /**
     * returns a list of all services on ENV-swarm
     * service-object looks like: {id, name, instances_up, instances_target, image, ports: ['port':'port']}
     * @returns {PromiseLike<T>}
     */
    getServices_E(){
        return this.executeCommand_E("docker service ls --format '{{.ID}};{{.Name}};{{.Replicas}};{{.Image}};{{.Ports}}'")
            .then(response => {
                return response.split('\n').map(
                    row => {
                        let split = row.split(semicolon_splitter);
                        if (split.length === 5) {
                            const replicasSplit = split[2].split('/');
                            return {
                                id: split[0],
                                name: split[1],
                                instances_up: replicasSplit[0],
                                instances_target: replicasSplit[1],
                                image: split[3],
                                ports: split[4].split(comma_splitter)
                            };
                        }
                    }
                );
            }).then(nodes => nodes.filter(it => it !== undefined))
    }

    /**
     * returns a list of all containers on ENV
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    getContainers_E(){
        return this.executeCommand_E(" docker ps --format '{{.Names}};{{.Image}};{{.Command}};{{.Status}};{{.Ports}}' --no-trunc")
            .then(response => {
                console.log(response);
                return response.split('\n').map(
                    row => {
                        let split = row.split(semicolon_splitter);
                        if (split.length === 5) {
                            return {
                                name: split[0],
                                image: split[1],
                                command: split[2],
                                status: split[3],
                                ports: split[4].split(comma_splitter)
                            };
                        }
                    }
                );
            })
    }

    /**
     * loads the inputfile and saves it on ENV at target-position
     * @param inputPath
     * @param inputFileName
     * @param targetPath
     * @param targetFileName
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    copyFile_H2E(inputPath, inputFileName, targetPath, targetFileName) {
        if (!targetFileName)
            targetFileName = inputFileName;
        const input = fs.readFileSync(`${inputPath}/${inputFileName}`);
        return this.copyFileContent_H2E(targetPath, targetFileName, input);
    }

    /**
     * saves the input-data into targetPath/targetFile
     * @param targetPath
     * @param targetFileName
     * @param input
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    copyFileContent_H2E(targetPath, targetFileName, input) {
        return this.createFolder_E(targetPath)
            .then(() => this.executeCommand(`echo '${input}' > ${targetPath}/${targetFileName}`));
    }

    /**
     * creates a dir on the ENV
     * @param dir
     * @param permission (775 as default)
     * @returns
     */
    createFolder_E(dir, permission = '775') {
        return this.executeCommand_E(`mkdir -p -m ${permission} '${dir}'`)
    }

    /**
     * execute command on the ENV
     * @param command
     */
    executeCommand_E(command) {
        log.info(`command ${command}`);
        return new Promise((resolve, reject) => {
            let response = "";
            this.sshconn.exec(command, function (err, stream) {
                if (err) {
                    console.log('SECOND :: exec error: ' + err);
                    return reject(err);
                }
                stream.on('end', () => {
                    return resolve(response);
                }).on('data', function (data) {
                    response += data.toString();
                });
            });
        });
    }    ;


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
                console.log("error making http call to tunneled consul, %o", error);
                return Promise.reject(this.sshconn.e);
            });
    }

    /**
     * Creates a local server socket on any free port and tunnels it to requested target host / port
     * The proxy info is stored in proxyServers under proxyKeyKey and has members
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
}
;

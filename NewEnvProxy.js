const Promise = require('bluebird');
const dns = require('dns');
const net = require('net');
const Client = require('ssh2').Client;
const axios = require('axios');
const fs = require('fs');
const exec = require('child_process');

const EpicLogger = require('./EpicLogger');
const log = new EpicLogger();

let default_config = {};

const semicolon_splitter = /\s*;\s*/; // split and trim in one regex <3
const comma_splitter = /\s*,\s*/;
const linebreak_splitter = /(\r\n|\n|\r)/gm;
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
            .then(() => this.createProxiedTunnel('consul', 'localhost', 8500))
            .then(() => this.lookupService('mysql'))
            .then(([ip, port]) => this.createProxiedTunnel('mysql', ip, port))
            .then(() => this)
            .catch((err) => console.log("init error: %o", err));
    };

    /**
     * copy file from ENV to NODE
     * @param node
     * @param inputPath
     * @param inputFileName
     * @param targetPath
     * @param targetFileName [optional: default=inputFileName]
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    copyFile_E2N(node, inputPath, inputFileName, targetPath, targetFileName) {
        if (!node)
            throw new Error('node missing');
        if (!targetFileName)
            targetFileName = inputFileName;
        return this.createFolder_N(node, targetPath)
            .then(() => this.executeCommand_E(`scp '${[inputPath, inputFileName].join('/')}' ${node}:${targetPath}/${targetFileName}`));
    }

    /**
     * copy a input-file from host to target-file on node
     * @param node
     * @param inputPath
     * @param inputFileName
     * @param targetPath
     * @param targetFileName
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    copyFile_H2N(node, inputPath, inputFileName, targetPath, targetFileName) {
        if (!node)
            throw new Error('node missing');
        if (!targetFileName)
            targetFileName = inputFileName;
        const input = fs.readFileSync(`${inputPath}/${inputFileName}`);
        return this.copyFileContent_2N(node, targetPath, targetFileName, input);
    }

    /**
     * copy the input into a targetfile on the node
     * @param node
     * @param input
     * @param targetPath
     * @param targetFileName
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    copyFileContent_2N(node, input, targetPath, targetFileName) {
        if (!node)
            throw new Error('node missing');
        return this.createFolder_N(node, targetPath)
            .then(() => this.executeCommand_N(node, `echo '${input}' > ${targetPath}/${targetFileName}`));
    }

    /**
     * read a file on a node
     * @param node
     * @param filePath
     * @param fileNameName
     * @returns {*}
     */
    readFile_N(node, filePath, fileNameName) {
        if (!node)
            throw new Error('node missing');
        return this.executeCommand_N(node, `cat ${[filePath, fileNameName].join('/')}`)
    }

    /**
     * creates a dir on the Node
     * @param node
     * @param dir
     * @param permission (775 as default)
     * @returns
     */
    createFolder_N(node, dir, permission = '775') {
        if (!node)
            throw new Error('node missing');
        return this.executeCommand_N(node, `mkdir -p -m ${permission} ${dir}`)
    }

    /**
     * executes command on node
     * @param node
     * @param command
     * @param surroundWithQuotes
     * @returns {*}
     */
    executeCommand_N(node, command, surroundWithQuotes = false) {
        if (!node)
            throw new Error('node missing');
        if (!command)
            throw new Error('command missing');
        if (surroundWithQuotes)
            return this.executeCommand_E(`ssh ${node} '${command}'`);
        else
            return this.executeCommand_E(`ssh ${node} ${command}`);
    }

    /**
     * reads a file on env
     * @param filePath
     * @param fileName
     * @returns {*}
     */
    readFile_E(filePath, fileName) {
        return this.executeCommand_E(`cat ${[filePath, fileName].join('/')}`)
    }

    /**
     *
     * @param node
     * @param service
     * @param onlyRunning
     * @returns {PromiseLike<T>}
     */
    getContainersOfService_N(node, service, onlyRunning = false) {
        if (!node)
            throw new Error('node missing');
        if (!service)
            throw new Error('service missing');
        return this.getContainers_N(node, onlyRunning)
            .then(nodes => nodes.filter(it => it.name.startsWith(service)))
    }

    /**
     * returns a list of all containers on a node
     * @param node
     * @param onlyRunning
     * @returns {PromiseLike<T>}
     */
    getContainers_N(node, onlyRunning = false) {
        if (!node)
            throw new Error('node missing');
        return this.executeCommand_N(node, `docker ps --format "{{.ID}};{{.Names}};{{.Image}};{{.Command}};{{.Status}};{{.Ports}}" --no-trunc ${onlyRunning ? '-f \"status=running\"' : ""}`, true) // quotes needed
            .then(response => response.split('\n').map(
                row => {
                    let split = row.split(semicolon_splitter);
                    if (split.length > 5) {
                        return {
                            containerId: split[0],
                            name: split[1],
                            image: split[2],
                            command: split[3],
                            status: split[4],
                            ports: split[5].split(comma_splitter),
                            node: node
                        };
                    }
                }
                )
            ).then(result => result.filter(it => it !== undefined))
    }

    /**
     * returns a list containing all nodes running the service
     * @param service
     * @param onlyRunning
     * @returns {PromiseLike<T>}
     */
    getNodesOfServices_E(service, onlyRunning = false) {
        if (!service)
            throw new Error('service missing');
        return this.executeCommand_E(`docker service ps ${service} --format '{{.ID}};{{.Name}};{{.Image}};{{.Node}};{{.DesiredState}};{{.CurrentState}};{{.Error}};{{.Ports}}' ${onlyRunning ? "-f 'desired-state=running'" : ""}`)
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
    getServices_E() {
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
    getContainers_E() {
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
        return this.createFolder_E(targetPath)
            .then(() => this.executeCommand_H(`scp -P ${this.config.admin_port} ${inputPath}/${inputFileName} ${this.config.admin_address}:${targetPath}/${targetFileName}`));
    }

    /**
     * saves the input-data into targetPath/targetFileName
     * @param targetPath
     * @param targetFileName
     * @param input
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    copyFileContent_2E(input, targetPath, targetFileName) {
        const tempFile = `cp_${this.getFileTimeStamp()}.temp`;
        let tempDir;
        return this.executeCommand_H('pwd')
            .then(dir => tempDir = `${dir.replace(linebreak_splitter, "")}/temp`)  // pwd return linebreaks
            .then(() => this.createFolder_H(tempDir))
            .then(() => this.executeCommand_H(`echo '${input}' > ${tempDir}/${tempFile}`))
            .then(() => this.copyFile_H2E(tempDir, tempFile, targetPath, targetFileName))
            .then(() => this.executeCommand_H(`rm -rf ${tempDir}`))
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
     * creates a dir on the HOST
     * @param dir
     * @param permission
     * @returns {*}
     */
    createFolder_H(dir, permission = '775') {
        return this.executeCommand_H(`mkdir -p -m ${permission} '${dir}'`)
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
     * execute command on HOST
     * @param command
     */
    executeCommand_H(command) {
        log.info(`command ${command}`);
        return new Promise((resolve, reject) =>
            exec.exec(command, (error, stdout, stderr) => { // Copy Pasta from NodeDocu
                if (error) {
                    console.error(`stderr: ${stderr}`);
                    console.error(`exec error: ${error}`);
                    return reject(error);
                }
                return resolve(stdout);
            })
        );
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

    // stupid util methods...

    /**
     * returns a string representing a timestamp yyyy_MM_dd_HH_hh_ss
     * @returns {string}
     */
    getFileTimeStamp() {
        const now = new Date();
        return `${now.getFullYear()}_${now.getMonth()}_${now.getDay()}_${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}`
    }

    suicide() {
        console.log("i can't thake this any more :(");
        console.log('closing proxies');
        for(let pxy in this.proxyServers){
            console.log(`closing${pxy}...`);
            let proxy = this.proxyServers[pxy];
            proxy.server.close();
            console.log(`... done.`)
        }
        console.log('closed all proxies');
        console.log('commiting suicide now - bye bye sad world!');
        this.sshconn.end();
    }

};

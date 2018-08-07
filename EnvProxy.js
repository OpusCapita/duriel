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

const dataSizes = {
    KB: 1024,
    MB: 1048576,
    GB: 1073741824
};


/**
 * Class to open a ssh-connection, execute commands and a proxy for multiple consul-functions
 * @class
 */
class EnvProxy {

    constructor() {
        this.proxyServers = {};
    }

    init(overrideconfig) {
        this.config = Object.assign({}, default_config, overrideconfig);
        this.sshconn = new Client();
        let initSsh = new Promise((resolve, reject) => {
            this.sshconn.on('ready', (err) => {
                log.info("ssh connection to " + this.config.admin_address + " established");
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
                agent: process.env.SSH_AUTH_SOCK,
                hostHash: 'md5',
                hostVerifier : (hash) => true
                // debug: (output) => log.severe(output) // this parameter is so useless...
            };

            log.debug("connecting to:", ssh_config);
            this.sshconn.connect(ssh_config);
        });

        return initSsh
            .then(() => this.createProxiedTunnel('consul', 'localhost', 8500))
            .then(() => this.lookupService('mysql'))
            .then(([ip, port]) => this.createProxiedTunnel('mysql', ip, port))
            .then(() => this)
            .catch((err) => {
                log.error("init error: ", err);
                throw err;
            });
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
     * copy a input-file from local to target-file on node
     * @param node
     * @param inputPath
     * @param inputFileName
     * @param targetPath
     * @param targetFileName
     * @returns {*|PromiseLike<T>|Promise<T>}
     */
    copyFile_L2N(node, inputPath, inputFileName, targetPath, targetFileName) {
        if (!node)
            throw new Error('node missing');
        if (!targetFileName)
            targetFileName = inputFileName;

        return this.copyFile_L2E(inputPath, inputFileName, targetPath, targetFileName)
            .then(() => this.copyFile_E2N(node, targetPath, targetFileName, targetPath, targetFileName));
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
            .then(() => this.copyFileContent_2E(input, targetPath, targetFileName))
            .then(() => this.copyFile_E2N(node, targetPath, targetFileName, targetPath, targetFileName))
            .then(() => this.executeCommand_E(`rm ${[targetPath, targetFileName].join('/')}`));
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
     * change permission on targetpath
     * permission can be number ( 777, 755, etc.) or +-operation (+x, +r)
     * @param node
     * @param targetPath
     * @param permission
     * @param sudo
     * @returns {*}
     */
    changePermission_N(node, targetPath, permission, sudo = false) {
        return this.executeCommand_N(node, `chmod ${permission} ${targetPath}`, sudo)
    }

    /**
     * creates a dir on the Node
     * @param node
     * @param dir
     * @param permission (775 as default)
     * @returns Promise
     */
    createFolder_N(node, dir, permission = '775') {
        if (!node)
            throw new Error('node missing');
        return this.executeCommand_N(node, `mkdir -p -m ${permission} ${dir}`)
    }

    /**
     * executes command on node
     * @param node
     * @param cmd - be sure to put the command in quotes ''
     * @param surroundWithQuotes
     * @param sudo
     * @returns {*}
     */
    async executeCommand_N(node, cmd, surroundWithQuotes = false, sudo = false) {
        if (!node)
            throw new Error('node missing');
        if (!cmd)
            throw new Error('command missing');

        let command = `ssh -o StrictHostKeyChecking=no -A ${node}`;
        command += ` ${sudo ? 'sudo' : ''}`;

        if (surroundWithQuotes)
            command += `'${cmd}'`;
        else
            command += `${cmd}`;
        log.severe("executing command", command);
        return this.executeCommand_E(command, sudo);
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
    async getContainersOfService_N(node, service, onlyRunning = false) {
        if (!node)
            throw new Error('node missing');
        if (!service)
            throw new Error('service missing');
        return await this.getContainers_N(node, onlyRunning)
            .then(result => {
                log.debug(`containers of node ${node}`, result.map(it => {
                    return {
                        name: it.name,
                        image: it.image
                    }
                }));
                log.severe("unformatted containers of node:", result);
                return result;
            })
            .then(result => result.filter(it => it.name.toLowerCase().startsWith(service.toLowerCase()))) //TODO: sauber implementieren!
            .then(result => {
                log.debug(`containers of service ${service} on node ${node}`, result);
                return result;
            })
    }

    /**
     * returns a list of all containers on a node
     * @param node
     * @param onlyRunning
     * @returns {PromiseLike<T>}
     */
    async getContainers_N(node, onlyRunning = false) {
        if (!node)
            throw new Error('node missing');

        return await this.executeCommand_N(node, `'docker ps --format "{{.ID}};{{.Names}};{{.Image}};{{.Command}};{{.Status}};{{.Ports}}" --no-trunc ${onlyRunning ? '-f \"status=running\"' : ""}'`) // quotes needed
            .then(response => {
                    log.severe(`docker ps response on node '${node}'`, response ? response : `'${response}'`);
                    return response.split('\n').map(
                        row => {
                            log.severe("docker ps entry: ", row);
                            let split = row.split(semicolon_splitter);
                            if (split.length > 5) {
                                return {
                                    containerId: split[0],
                                    name: split[1],
                                    image: split[2],
                                    command: split[3],
                                    status: this.parseContainerStatus(split[4]),
                                    ports: split[5].split(comma_splitter),
                                    node: node
                                };
                            } else {
                                log.severe("skipping row", row)
                            }
                        }
                    )
                }
            ).then(result => result.filter(it => it !== undefined))
    }

    /**
     * Remove all passed secrets from the swarm.
     * Environment of this proxy should be a <b>swarm-master</b>
     * @param secretNames (secrets that should be removed)
     * @returns-
     */
    removeDockerSecret(...secretNames) {
        return this.executeCommand_E(`docker secret rm ${secretNames.join(" ")}`);
    }

    /**
     * add a secret into the docker swarm
     * @param secret
     * @param secretName
     * @returns {*}
     */
    insertDockerSecret(secret, secretName) {
        return this.executeCommand_E(`echo '${secret}' | docker secret create '${secretName}' - `);
    }

    /**
     * Reads in all running containers the given secret.
     * @param serviceName
     * @param secretName
     * @returns Array<string> of all secrets
     */
    async readDockerSecretOfService_E(serviceName, secretName) {
        const fetchedSecrets = [];
        const serviceTasks = await this.getTasksOfServices_E(serviceName, true);
        for (let task of serviceTasks) {
            log.debug(`fetching in task: ${task.name}`);
            try {
                const containers = await this.getContainersOfService_N(task.node, serviceName, true);
                const containerInfo = containers.map(it => `{name: ${it.name}, image: ${it.image}}`);
                log.debug(`iterating over containsers [${containerInfo.join(', ')}] of node: `, task.node);
                if (!containerInfo.length) {
                    log.warn("No Containers found. This is strange... Did you try to disconnect your router for 2-3 min?", containers)
                }
                for (let container of containers) {
                    log.severe(`doing container '${container.containerId}'`);
                    try {
                        const command = `docker exec ${container.containerId} cat /run/secrets/${secretName}`;
                        const secret = await this.executeCommand_N(task.node, command, true);
                        if (secret) {
                            const regexResult = new RegExp(/^\S+/).exec(secret);
                            if (regexResult && regexResult.length > 0) {
                                log.severe("adding secret!: ", regexResult[0].substring(0, 5));
                                if (!fetchedSecrets.includes(regexResult[0])) {
                                    fetchedSecrets.push(regexResult[0]);
                                }
                            } else {
                                log.warn(`Could not fetch a secret from node: '${task.node}' and container '${container.containerId}'`);
                            }
                        }
                    } catch (error) {
                        log.error(`error while fetching secret from container ${container.containerId}`, error);
                    }
                }
            } catch (error) {
                log.error(`error while fetching secret from task '${task.node}'`, error);
            }
        }
        return fetchedSecrets.filter(it => it); // filter out empty entries
    }

    /**
     * returns a list containing all tasks running the service
     * @param service
     * @param onlyRunning
     * @returns {PromiseLike<object>} e.g. {id, name, image, node, desiredState, currentState, error, [ports]}
     */
    getTasksOfServices_E(service, onlyRunning = false) {
        if (!service)
            throw new Error('service missing');
        return this.executeCommand_E(`docker service ps ${service} --format '{{.ID}};{{.Name}};{{.Image}};{{.Node}};{{.DesiredState}};{{.CurrentState}};{{.Error}};{{.Ports}}' ${onlyRunning ? "-f 'desired-state=running'" : ""}`)
            .then(response => {
                log.debug(`docker service ps ${service}`, response);
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
            .then(nodes => {
                log.debug(`tasks of service '${service}'`, nodes.map(it => {
                    return {
                        id: it.id,
                        node: it.node
                    }
                }));
                log.severe("unformatted tasks: " + service, nodes);
                return nodes;
            })
    }

    /**
     * returns a list of all services on ENV-swarm
     * service-object looks like: {id, name, instances_up, instances_target, image, ports: ['port':'port']}
     * @returns {PromiseLike<object>} e.g. {id: '', name: '', instances_up: '', instances_target: '', image: '', ports: ['port':'port']}
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
            }).then(nodes => {
                if (!nodes || !nodes.length) {
                    log.warn("no nodes found... this is strange...", nodes);
                    return [];
                }
                return nodes.filter(it => it !== undefined)
            })
    }

    /**
     * returns a list of all containers on ENV
     * @returns {Promise<Array<object>>} e.g. [{name, image, command, status, [port:port]}]
     */
    getContainers_E() {
        return this.executeCommand_E(" docker ps --format '{{.Names}};{{.Image}};{{.Command}};{{.Status}};{{.Ports}}' --no-trunc")
            .then(response => {
                return response.split('\n').map(
                    row => {
                        let split = row.split(semicolon_splitter);
                        if (split.length === 5) {
                            return {
                                name: split[0],
                                image: split[1],
                                command: split[2],
                                status: this.parseContainerStatus(split[3]),
                                ports: split[4].split(comma_splitter)
                            };
                        }
                    }
                );
            })
    }

    async getServiceInspect_E(serviceName) {
        try {
            const serviceInformation = JSON.parse(await this.executeCommand_E(`docker service inspect ${serviceName}`));
            if ((serviceInformation && serviceInformation.length === 0) || !serviceInformation) {
                log.warn("no service information in docker for service: " + serviceName);
                return;
            }
            return serviceInformation;
        } catch (error) {
            log.error("error while fetching service information", error);
        }
    }

    getNodes_E() {
        return this.executeCommand_E("docker node ls --format '{{.ID}};{{.Hostname}};{{.Status}};{{.Availability}};{{.ManagerStatus}}'")
            .then(response => {
                return response.split('\n').map(
                    row => {
                        let split = row.split(semicolon_splitter);
                        if (split.length >= 4) {
                            return {
                                id: split[0],
                                hostname: split[1],
                                status: split[2],
                                availability: split[3],
                                managerstatus: split[4]
                            };
                        }
                    }
                )
            })
            .then(result => result.filter(it => it));
    }

    /**
     * loads the inputfile and saves it on ENV at target-position
     * @param inputPath
     * @param inputFileName
     * @param targetPath
     * @param targetFileName
     * @returns {Promise}
     */
    copyFile_L2E(inputPath, inputFileName, targetPath, targetFileName) {
        if (!targetFileName)
            targetFileName = inputFileName;
        return this.createFolder_E(targetPath)
            .then(() => this.executeCommand_L(`scp -P ${this.config.admin_port} ${inputPath}/${inputFileName} ${this.config.admin_address}:${targetPath}/${targetFileName}`));
    }

    /**
     * saves the input-data into targetPath/targetFileName
     * @param targetPath
     * @param targetPath
     * @param targetFileName
     * @param input
     * @returns {PromiseLike<T>}
     */
    copyFileContent_2E(input, targetPath, targetFileName) {
        const tempFile = `cp_${EnvProxy.getFileTimeStamp()}.temp`;
        let tempDir;
        return this.executeCommand_L('pwd')
            .then(dir => tempDir = `${dir.replace(linebreak_splitter, "")}/temp`)
            .then(() => this.createFolder_L(tempDir))
            .then(() => this.executeCommand_L(`echo '${input}' > ${tempDir}/${tempFile}`))
            .then(() => this.copyFile_L2E(tempDir, tempFile, targetPath, targetFileName))
            .then(() => this.executeCommand_L(`rm -rf ${tempDir}`))
    }

    /**
     * changes permission of targetPath
     * @param targetPath
     * @param permission
     * @param sudo
     * @returns {*}
     */
    changePermission_E(targetPath, permission, sudo = false) {
        return this.executeCommand_E(`chmod ${permission} ${targetPath}`, sudo)
    }

    /**
     * creates a dir on the ENV
     * @param dir
     * @param permission (775 as default)
     * @returns Promise<>
     */
    createFolder_E(dir, permission = '775') {
        return this.executeCommand_E(`mkdir -p -m ${permission} '${dir}'`)
    }

    /**
     * returns a list of all containers on a node
     * @param node
     * @param onlyRunning
     * @returns {PromiseLike<T>}
     */
    getContainers_L(onlyRunning = false) {
        return this.executeCommand_L(`docker ps --format "{{.ID}};{{.Names}};{{.Image}};{{.Command}};{{.Status}};{{.Ports}}" --no-trunc ${onlyRunning ? '-f \"status=running\"' : ""}`) // quotes needed
            .then(response => response.split('\n').map(
                row => {
                    let split = row.split(semicolon_splitter);
                    if (split.length > 5) {
                        return {
                            containerId: split[0],
                            name: split[1],
                            image: split[2],
                            command: split[3],
                            status: this.parseContainerStatus(split[4]),
                            ports: split[5].split(comma_splitter)
                        };
                    }
                })
                // ).then(result => new Promise((resolve, reject) => resolve(result.filter(it => it !== undefined))))  // needed for async await?
            ).then(result => result.filter(it => it !== undefined))  // needed for async await?
    }

    /**
     * returns a list of all services locally
     * service-object looks like: {id, name, instances_up, instances_target, image, ports: ['port':'port']}
     * @returns {PromiseLike<object>} e.g. {id: '', name: '', instances_up: '', instances_target: '', image: '', ports: ['port':'port']}
     */
    getServices_L() {
        return this.executeCommand_L("docker service ls --format '{{.ID}};{{.Name}};{{.Replicas}};{{.Image}};{{.Ports}}'")
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
     * changes the file permission on targetpath on local machine
     * @param targetPath
     * @param permission - e.g. '+x', '770'
     * @param sudo[optional] - use sudo for command or not
     * @returns Promise<>
     */
    changePermission_L(permission, targetPath, sudo = false) {
        return this.executeCommand_L(`chmod ${permission} ${targetPath}`, sudo)
    }

    /**
     * creates a dir on the HOST
     * @param dir
     * @param permission
     * @returns {*}
     */
    createFolder_L(dir, permission = '775') {
        return this.executeCommand_L(`mkdir -p -m ${permission} '${dir}'`)
    }

    /**
     * execute command on the ENV
     * @param command
     * @param sudo
     * @param loggingStream -
     */
    async executeCommand_E(command, sudo = false) {
        if (sudo) {
            command = 'sudo ' + command;
        }
        return new Promise((resolve, reject) => {
            let response = "";
            let stdError = [];
            this.sshconn.exec(command, function (err, stream) {
                if (err) {
                    log.error('SECOND :: exec error: ', err);
                    log.warn("output before error: ", response);
                    return reject(err);
                }
                stream.on('end', () => {
                    if (stdError && stdError.length) {
                        log.warn(stdError.join(''));
                    }
                    return resolve(response);
                }).on('data', function (data) {
                    response += data.toString();
                }).on('error', streamError => {
                    return reject(streamError);
                });
                stream.stderr.on('data', error => {
                    stdError.push(error);
                })
            });
        });
    };

    readFile_L(filePath, fileName, encoding = 'utf8') {
        const path = `${filePath}/${fileName}`;
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path)) {
                reject("no such file found");
            } else {
                fs.readFileSync(path, encoding);
            }
        });
    }

    /**
     * execute command on local machine
     * @param command
     * @param sudo
     * @param bufferSize    bufferSize of stdout in Bytes - default is 500MB
     */
    executeCommand_L(command, sudo = false, bufferSize = 500 * dataSizes.MB) {
        if (sudo) {
            command = 'sudo ' + command;
        }
        return new Promise((resolve, reject) =>
            exec.exec(command, {maxBuffer: bufferSize}, (error, stdout, stderr) => { // Copy Pasta from NodeDocu
                if (error) {
                    log.error(`stderr: ${stderr}`);
                    return reject(error);
                }
                return resolve(stdout);
            })
        );
    }

    changeCommandDir_L(dir) {
        if (!dir)
            throw new Error('dir not found');
        return new Promise((resolve, reject) => {
                try {
                    resolve(process.chdir(dir))
                } catch (error) {
                    reject(error)
                }
            }
        )
    }

    getNodes_L(onlyReady = false, onlyAvailable = false) {
        return this.executeCommand_L(`docker node ls --format "{{.ID}};{{.Hostname}};{{.Status}};{{.Availability}}"`)
            .then(response => response.split('\n').map(
                row => {
                    let split = row.split(semicolon_splitter);
                    if (split.length === 4) {
                        return {
                            Id: split[0],
                            hostname: split[1],
                            status: split[2],
                            available: split[3]
                        };
                    }
                })
            )
            .then(result => result.filter(it => it !== undefined))
            .then(result => result.filter(it => (!onlyReady || it.status === "Ready") && (!onlyAvailable || it.available === "Active")))

    }

    getConsulHealthCheck(serviceName) {
        return this.queryConsul(`/v1/health/service/${serviceName}`)
    }

    /**
     * finds mysql ip on target env
     * returns promise on an array like [ip,port]
     */
    lookupService(serviceName) {
        log.info("looking up service " + serviceName + "...");
        return this.queryConsul('/v1/catalog/service/' + serviceName)
            .then(data => {
                log.debug(serviceName + ' looked up: ' + data[0].Address);
                return Promise.resolve([data[0].Address, data[0].ServicePort]);
            })
            .catch(error => {
                log.error(`error looking up '${serviceName}'`, error);
                throw error;
            });
    }

    /**
     * returns json response from consul
     */
    async queryConsul(apiCall) {
        const proxy = this.proxyServers['consul'];
        if (!proxy) return Promise.reject('no proxy for consul found!');
        return await axios.get('http://localhost:' + proxy.port + apiCall)
            .then((response) => {
                return response.data;
            })
            .catch(error => {
                log.error("error making http call to tunneled consul:", error);
                return this.sshconn.e;
            });
    }

    /**
     * Add a kv-pair into consul
     * @param key - no need to starting '/'
     * @param value
     * @returns http-response of consul | Promise.reject(error)
     */
    async addKeyValueToConsul(key, value) {
        const proxy = this.proxyServers['consul'];
        if (!proxy) return Promise.reject('no proxy for consul found!');
        return await axios.put(`http://localhost:${proxy.port}/v1/kv/${key}`, value)
            .then((response) => {
                return Promise.resolve(response.data);
            })
            .catch(error => {
                log.error("error making http call to tunneled consul", error);
                return Promise.reject(this.sshconn.e);
            });
    }

    /**
     * request keyValue in consul.
     * @param key
     * @returns value as String | Promise.reject
     */
    async getKeyValue(key) {
        return await this.queryConsul(`/v1/kv/${key}?raw`);
    }

    /**
     * Creates a local server socket on any free port and tunnels it to requested target host / port
     * The proxy info is stored in proxyServers under proxyKeyKey and has members
     * name = it's proxyKey
     * server = the net.server holding the socket and accept handler
     * port = the proxy port
     * Returns a promise on a ready to use proxy instance
     */
    createProxiedTunnel(proxyKey, targetHostName, targetPort) {
        log.info(`creating proxy ${proxyKey} pointing to ${targetHostName}:${targetPort}...`);
        const proxy = {};
        proxy.name = proxyKey;
        this.proxyServers[proxyKey] = proxy;

        proxy.server = net.createServer((conn) => {
            log.debug(`proxySrv for ${targetHostName}:${targetPort} handling client request, remote port = ${conn.remotePort}`);
            conn.on('end', () => {
                log.severe('proxySrv client disconnected from socket');
            });
            conn.on('close', () => {
                log.severe('proxySrv client socket closed');
            });

            log.severe(`connecting client to proxyStream, remote address ${conn.remoteAddress} remote port ${conn.remotePort}`);

            this.sshconn.forwardOut('localhost',
                this.proxyServers[proxyKey].port,
                targetHostName,
                targetPort,
                (err, stream) => {
                    if (err) {
                        log.error("forwarding failed: ", err);
                        this.sshconn.end();
                    } else {
                        log.severe("proxy forwarding via ssh, piping stream to socket");
                        stream.on('end', function (msg) {
                            log.severe('stream end event on proxyStream', msg);
                        });
                        this.sshconn.on('close', () => {
                            log.severe("sshconn stream closing");
                        });
                        stream.pipe(conn);
                        conn.pipe(stream);
                    }
                });
            log.severe(`client ${conn.remotePort} attached to ${proxyKey} proxyStream`);
        });

        proxy.server.maxConnections = 1;
        proxy.server.on('error', (err) => {
            log.error(proxyKey + "proxy server error : ", err);
        });

        return new Promise(function (resolve, reject) {
            proxy.server.listen(0, (err) => {
                if (err) {
                    log.error(proxyKey + "proxy server listen failed: ", err);
                    reject(err);
                }
                proxy.port = proxy.server.address().port;
                log.debug(`${proxyKey} proxy server bound to ${proxy.port}`);
                resolve(proxy);
            });
        });
    }

    // stupid helpers methods...

    /**
     * returns a string representing a timestamp yyyy_MM_dd_HH_hh_ss
     * @returns {string}
     */
    static getFileTimeStamp() {
        const now = new Date();
        return `${now.getFullYear()}_${now.getMonth()}_${now.getDay()}_${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}`
    }

    close() {
        log.debug('closing... ');
        log.severe('closing proxies... ');
        for (let pxy in this.proxyServers) {
            log.severe(`closing ${pxy}...`);
            let proxy = this.proxyServers[pxy];
            proxy.server.close();
            log.severe(`... done.`)
        }
        log.severe('closed all proxies');
        log.severe('closing client itself.');
        this.sshconn.end();
        log.debug('... bye bye');
        return Promise.resolve();
    }

    parseContainerStatus(status) {
        const statusLowerCase = status.toLowerCase();
        let result = 'unknown';
        if (statusLowerCase.includes('(unhealthy)')) {
            result = 'unhealthy';
        } else if (statusLowerCase.includes('(healthy)')) {
            result = 'healthy';
        } else if (statusLowerCase.includes('starting')) {
            result = 'starting';
        }
        return result;
    };

};

module.exports = EnvProxy;



























'use strict';
const assert = require("assert");
const dockerCommandBuilder = require('../actions/docker/dockerCommandBuilder');
const fileHelper = require('../actions/filehandling/fileHandler');


const taskTemplatePath = "./task_template.json";
const fieldDefsPath = "./field_defs.json";
const serviceConfigPath = "./service_config.json";

const dummyConfig = {
    HUB_REPO: 'OpusCapita/dummy-service',
    VERSION: '1.0.2c',
    serviceSecretName: 'super_secret_stuff',
    CIRCLE_PROJECT_REPONAME: 'dummy-service',
    serviceName: 'dummy-service',
    logstash_ip: '127.0.0.1',
    CIRCLE_TOKEN: 'abcdefghijklmnoprstuvwyz0123456789',
    TARGET_ENV: 'dev',
    SECRET_dev_REDIS: 'redis_secret',
    SECRET_dev_TICKET_ENV: 'develop_env'
};

module.exports.run = run;

function run() {
    describe("Docker Command Building", () => {
        it("musst be done in future", () => true);
        // const enrichedConfig = require("../actions/getEnvVariables").getBaseConfigObject(dummyConfig);
        // prepareTaskTemplate(enrichedConfig);
        // prepareFieldDefs(enrichedConfig);
        // prepareServiceConfig(enrichedConfig);
        // it("create mode", () => {
        //     const command = dockerCommandBuilder.dockerCreate(enrichedConfig);
        //     assert.equal(command, "docker service create -d --with-registry-auth --secret='super_secret_stuff' --name dummy-service --log-driver gelf --log-opt gelf-address=udp://127.0.0.1:12201 --log-opt tag=\"dummy-service\" --constraint engine.labels.nodetype==worker --publish mode=host,target=3019,published=3019,protocol=tcp --host consul:172.17.0.1 --env SERVICE_NAME=dummy-service --env SERVICE_3019_CHECK_HTTP=/api/health/check --env SERVICE_3019_CHECK_INTERVAL=15s --env SERVICE_3019_CHECK_TIMEOUT=3s --env NODE_ENV=production --env TICKET_ENV=develop_env OpusCapita/dummy-service:1.0.2c");
        // });
        // it("update mode", () => {
        //     const command = dockerCommandBuilder.dockerUpdate(enrichedConfig);
        //     assert.equal(command, "docker service update -d --with-registry-auth --log-driver gelf --log-opt gelf-address=udp://127.0.0.1:12201 --log-opt tag=\"dummy-service\" --env-add SERVICE_NAME=dummy-service --env-add TICKET_ENV=develop_env --force --image OpusCapita/dummy-service:1.0.2c dummy-service");
        // });
        // it("cleanup", () => cleanup())
    })
}

async function prepareTaskTemplate(enrichedConfig) {
    const dummyTaskTemplate = {
        "default": {
            "name": "${serviceName}",
            "log-driver": "gelf",
            "log-opt": [
                "gelf-address=udp://${logstash_ip}:12201",
                "tag=\"${serviceName}\""
            ],
            "constraint": [
                "engine.labels.nodetype==worker"
            ],
            "publish": [
                "mode=host,target=3019,published=3019,protocol=tcp"
            ],
            "host": [
                "consul:172.17.0.1"
            ],
            "env": [
                "SERVICE_NAME=${serviceName}",
                "SERVICE_3019_CHECK_HTTP=/api/health/check",
                "SERVICE_3019_CHECK_INTERVAL=15s",
                "SERVICE_3019_CHECK_TIMEOUT=3s",
                "NODE_ENV=production",
                "TICKET_ENV=${SECRET_:env_TICKET_ENV}"
            ],
            "oc-db-init": {
                "populate-test-data": "true"
            },
            "oc-consul-injection": {
                "redis/password": "${SECRET_:env_REDIS}",
                "ticket-env": "${SECRET_:env_TICKET_ENV}",
                "circle-ci-api-key": "${CIRCLE_TOKEN}"
            }
        }
    };
    await fileHelper.saveObject2File(dummyTaskTemplate, taskTemplatePath);
    console.log("2342342" + await fileHelper.loadTaskTemplate(enrichedConfig))
}

function cleanup() {
    const fs = require("fs");
    fs.unlinkSync(taskTemplatePath);
    fs.unlinkSync("./task_template_mapped.json");
    fs.unlinkSync(serviceConfigPath);
    fs.unlinkSync(fieldDefsPath);
}

function prepareServiceConfig(enrichedConfig) {
    const serviceInspect = [
        {
            "ID": "fyikz2xeb6vasdbjgah4vjdyi",
            "Version": {
                "Index": 661389
            },
            "CreatedAt": "2018-03-28T09:18:23.175683325Z",
            "UpdatedAt": "2018-04-05T14:26:15.32758647Z",
            "Spec": {
                "Name": "andariel-monitoring",
                "Labels": {},
                "TaskTemplate": {
                    "ContainerSpec": {
                        "Image": "opuscapita/andariel-monitoring:1.0.2-dev-249@sha256:aac4501d22103d24a4ad781e0d8ff4917fbfdc3d8bfe3bd50ceb71f5849d2dd6",
                        "Env": [
                            "SERVICE_NAME=andariel-monitoring",
                            "SERVICE_3019_CHECK_HTTP=/api/health/check",
                            "SERVICE_3019_CHECK_INTERVAL=15s",
                            "SERVICE_3019_CHECK_TIMEOUT=3s",
                            "NODE_ENV=production",
                            "TICKET_ENV=develop"
                        ],
                        "StopGracePeriod": 10000000000,
                        "Hosts": [
                            "172.17.0.1 consul"
                        ],
                        "DNSConfig": {},
                        "Secrets": [
                            {
                                "File": {
                                    "Name": "andariel-monitoring-consul-key",
                                    "UID": "0",
                                    "GID": "0",
                                    "Mode": 292
                                },
                                "SecretID": "yxxkkizb3jynigsdxs8uy72eu",
                                "SecretName": "andariel-monitoring-consul-key"
                            }
                        ]
                    },
                    "Resources": {
                        "Limits": {},
                        "Reservations": {}
                    },
                    "RestartPolicy": {
                        "Condition": "any",
                        "Delay": 5000000000,
                        "MaxAttempts": 0
                    },
                    "Placement": {
                        "Constraints": [
                            "engine.labels.nodetype==worker"
                        ],
                        "Platforms": [
                            {
                                "Architecture": "amd64",
                                "OS": "linux"
                            }
                        ]
                    },
                    "LogDriver": {
                        "Name": "gelf",
                        "Options": {
                            "gelf-address": "udp://172.17.0.1:12201",
                            "tag": "andariel-monitoring"
                        }
                    },
                    "ForceUpdate": 25,
                    "Runtime": "container"
                },
                "Mode": {
                    "Replicated": {
                        "Replicas": 1
                    }
                },
                "UpdateConfig": {
                    "Parallelism": 1,
                    "FailureAction": "pause",
                    "Monitor": 5000000000,
                    "MaxFailureRatio": 0,
                    "Order": "stop-first"
                },
                "RollbackConfig": {
                    "Parallelism": 1,
                    "FailureAction": "pause",
                    "Monitor": 5000000000,
                    "MaxFailureRatio": 0,
                    "Order": "stop-first"
                },
                "EndpointSpec": {
                    "Mode": "vip",
                    "Ports": [
                        {
                            "Protocol": "tcp",
                            "TargetPort": 3019,
                            "PublishedPort": 3019,
                            "PublishMode": "host"
                        }
                    ]
                }
            },
            "PreviousSpec": {
                "Name": "andariel-monitoring",
                "Labels": {},
                "TaskTemplate": {
                    "ContainerSpec": {
                        "Image": "opuscapita/andariel-monitoring:1.0.2-dev-248@sha256:8e9976ee2da048b85493332514d15ec415076e118326fe7e9d1bb90d3c1d2ae2",
                        "Env": [
                            "SERVICE_NAME=andariel-monitoring",
                            "SERVICE_3019_CHECK_HTTP=/api/health/check",
                            "SERVICE_3019_CHECK_INTERVAL=15s",
                            "SERVICE_3019_CHECK_TIMEOUT=3s",
                            "NODE_ENV=production",
                            "TICKET_ENV=develop"
                        ],
                        "Hosts": [
                            "172.17.0.1 consul"
                        ],
                        "DNSConfig": {},
                        "Secrets": [
                            {
                                "File": {
                                    "Name": "andariel-monitoring-consul-key",
                                    "UID": "0",
                                    "GID": "0",
                                    "Mode": 292
                                },
                                "SecretID": "yxxkkizb3jynigsdxs8uy72eu",
                                "SecretName": "andariel-monitoring-consul-key"
                            }
                        ]
                    },
                    "Resources": {
                        "Limits": {},
                        "Reservations": {}
                    },
                    "Placement": {
                        "Constraints": [
                            "engine.labels.nodetype==worker"
                        ],
                        "Platforms": [
                            {
                                "Architecture": "amd64",
                                "OS": "linux"
                            }
                        ]
                    },
                    "LogDriver": {
                        "Name": "gelf",
                        "Options": {
                            "gelf-address": "udp://172.17.0.1:12201",
                            "tag": "andariel-monitoring"
                        }
                    },
                    "ForceUpdate": 24,
                    "Runtime": "container"
                },
                "Mode": {
                    "Replicated": {
                        "Replicas": 1
                    }
                },
                "EndpointSpec": {
                    "Mode": "vip",
                    "Ports": [
                        {
                            "Protocol": "tcp",
                            "TargetPort": 3019,
                            "PublishedPort": 3019,
                            "PublishMode": "host"
                        }
                    ]
                }
            },
            "Endpoint": {
                "Spec": {
                    "Mode": "vip",
                    "Ports": [
                        {
                            "Protocol": "tcp",
                            "TargetPort": 3019,
                            "PublishedPort": 3019,
                            "PublishMode": "host"
                        }
                    ]
                },
                "Ports": [
                    {
                        "Protocol": "tcp",
                        "TargetPort": 3019,
                        "PublishedPort": 3019,
                        "PublishMode": "host"
                    }
                ]
            },
            "UpdateStatus": {
                "State": "completed",
                "StartedAt": "2018-04-05T14:24:34.939872148Z",
                "CompletedAt": "2018-04-05T14:26:15.32756587Z",
                "Message": "update completed"
            }
        }
    ];
    fileHelper.saveObject2File(serviceInspect, serviceConfigPath);
}

function prepareFieldDefs(enrichedConfig) {
    const fieldDefs = {
        "constraint": {"path": "Spec/TaskTemplate/Placement/Constraints", "type": "mar"},
        "dns-search": {"path": "Spec/TaskTemplate/ContainerSpec/DNSConfig/Search", "type": "mar"},
        "env": {"path": "Spec/TaskTemplate/ContainerSpec/Env", "type": "mark"},
        "host": {"path": "Spec/TaskTemplate/ContainerSpec/Hosts", "type": "marh"},
        "hostname": {"path": "Spec/TaskTemplate/ContainerSpec/Hostname", "type": "repl"},
        "log-driver": {"path": "Spec/TaskTemplate/LogDriver/Name", "type": "repl"},
        "log-opt": {"path": "Spec/TaskTemplate/LogDriver/Options", "type": "frepl"},
        "mode": {"path": "Spec/Mode", "type": "create"},
        "mount": {"path": "Spec/TaskTemplate/ContainerSpec/Mounts", "type": "mart", "keyNames": ["Target"]},
        "name": {"path": "Spec/Name", "type": "create"},
        "publish": {
            "path": "Spec/EndpointSpec/Ports",
            "type": "mart",
            "keyNames": ["TargetPort", "Protocol"],
            "fieldMap": {"Target": "TargetPort", "Mode": "PublishMode", "Published": "PublishedPort"},
            "rmKeyType": "srcKVCommaSeparated"
        },
        "replicas": {"path": "Spec/Mode/Replicated/Replicas", "type": "repl"}
    };
    fileHelper.saveObject2File(fieldDefs, fieldDefsPath);
}

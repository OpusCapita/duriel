const assert = require('assert');
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;
const testConstants = require("./TestConstants");

const fs = require('fs');
const constants = require('./TestConstants');

const fileHelper = require('../actions/filehandling/fileHandler');
const loadConfigFile = require('../actions/filehandling/loadConfigFile');
const loadTaskTemplate = require('../actions/filehandling/loadTaskTemplate');

const EnvProxy = require("../EnvProxy");

module.exports.run = run;

function run() {
    describe("File Handling", () => {
        const dummyConfigPath = `./dummyConfig-${new Date().getTime()}.json`;

        before(() => {
            fileHelper.saveObject2File(constants.testConfigFields, dummyConfigPath, true)
        });

        after(() => {
            fs.unlinkSync(dummyConfigPath);
        });
        const enhancedSimple = getBaseConfigObject(testConstants.testConfigFields);

        it("loads a  non existing config file", () => {
            assert.throws(
                () => loadConfigFile("kevin"),
                Error,
                ""
            )
        });

        it("load a config file", () => {
            const fromFile = loadConfigFile(dummyConfigPath);

            // deepEquals not working...
            const entries = Object.keys(enhancedSimple)
                .filter(key => typeof enhancedSimple[key] !== 'function')
                .concat(Object.keys(fromFile).filter(key => typeof enhancedSimple[key] !== 'function'))

            entries.forEach(entry => {
                assert.equal(enhancedSimple[entry], fromFile[entry])
            })
        });

        it("loading dummy config and comparing with origin", () => {
            const config = loadConfigFile(dummyConfigPath);

            const fromFile = config.get(constants.checkedField);
            const fromCode = enhancedSimple.get(constants.checkedField);

            assert.notEqual(fromFile, null);
            assert.notEqual(fromCode, null);
            assert.equal(fromFile, fromCode);
        });
        describe("get files in dir", () => {
            it("fetches the filenames in a dir", () => {
                const files = fileHelper.getFilesInDir(__dirname);
                assert.equal(Array.isArray(files), true);
                assert.equal(files.includes(__filename), true);
            });
            it("fetches the filenames in a dir", () => {
                const files = fileHelper.getFilesInDir(require("path").join(__dirname, ".."));
                assert.equal(Array.isArray(files), true);
                assert.equal(files.includes(__filename), true);
            });
            it("fetches form a non existing dir", () => {
                assert.throws(() => fileHelper.getFilesInDir("allessandroDel/Pocko"))
            });
            it("fetches form a file as path", () => {
                const files = fileHelper.getFilesInDir(require("path").join(__filename));
                assert.equal(Array.isArray(files), true);
                assert.equal(files.includes(__filename), true);

            });
        });
        describe("loads a task_template", () => {
            before(() => fileHelper.saveObject2File(constants.task_template, "./task_template.json"));
            after(() => require("fs").unlinkSync("./task_template.json"));
            const content = {
                default: {
                    kevin: 3
                },
                develop: {
                    kevin: 4
                }
            };
            const expected_develop = {
                kevin: 4
            };
            const expected_del_pocko = {
                kevin: 3
            };
            it("loads for an env", () => {
                const config = getBaseConfigObject({
                    TARGET_ENV: "develop"
                });
                const taskTemplate_develop = loadTaskTemplate(config, content);
                assert.deepEqual(expected_develop, taskTemplate_develop);
            });
            it("loads without an env", () => {
                const config = getBaseConfigObject({});
                const taskTemplate_del_pocko = loadTaskTemplate(config, content);
                assert.deepEqual(expected_del_pocko, taskTemplate_del_pocko);
            });

            it("get no env and no content", () => {
                assert.throws(
                    () => loadTaskTemplate(undefined, undefined),
                    Error,
                    ""
                )
            });
            it("get no env", () => {
                assert.throws(
                    () => loadTaskTemplate(undefined, content),
                    Error,
                    ""
                )

            });
            it("get no content", () => {
                const config = getBaseConfigObject({});
                assert.doesNotThrow(() => {
                    loadTaskTemplate(config, undefined)
                }, Error, "")
            });
            it("injects vars", async () => {
                const config = getBaseConfigObject({
                    alpha: "beta",
                    logstash_ip: "1.1.1.1",
                    serviceName: "s",
                    TARGET_ENV: "develop",
                    SECRET_develop_REDIS: "redis_pass",
                    SECRET_develop_RABBITMQUSER: "admin",
                    SECRET_develop_RABBITMQPASS: "rabbit_pass"
                });
                const taskTemplate = {
                    "default":{
                        "name":"${serviceName}",
                        "log-driver":"gelf",
                        "log-opt":["gelf-address=udp://${logstash_ip}:12201", "tag=\"${serviceName}\""],
                        "constraint":["engine.labels.nodetype==worker"],
                        "publish":["mode=host,target=3008,published=3008,protocol=tcp"],
                        "host":["consul:172.17.0.1"],
                        "env":[
                            "SERVICE_NAME=${serviceName}",
                            "SERVICE_3008_CHECK_HTTP=/api/health/check",
                            "SERVICE_3008_CHECK_INTERVAL=15s",
                            "SERVICE_3008_CHECK_TIMEOUT=3s",
                            "NODE_ENV=production"
                        ],
                        "oc-db-init":{"populate-test-data":"true"},
                        "oc-consul-injection":{
                            "redis/password": "${SECRET_:env_REDIS}",
                        }
                    }
                };
                const template = loadTaskTemplate(config, taskTemplate);
                assert.deepEqual(template['log-opt'],[`gelf-address=udp://${config.get('logstash_ip')}:12201`, `tag=\"${config.get('serviceName')}\"`]);
                assert.equal(template['name'], config.get('serviceName'));
                assert.equal(template['oc-consul-injection']['redis/password'], config.get('SECRET_develop_REDIS'));
            });
        });
        describe("mkdirp", () => {
            const timeStamp = new Date().getTime() + "";
            const path = require("path").resolve("./", timeStamp, "tmp");

            after(() => {
                new EnvProxy().executeCommand_L(`rm -rf ${timeStamp}`)
            });

            it("creates a folder", () => {
                fileHelper.mkdirp(path);
                assert.equal(require("fs").existsSync(path), true);
            })
        })
    });
}
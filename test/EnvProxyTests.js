const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const assert = require('assert');

const constants = require('./TestConstants');

const EnvProxy = require('../EnvProxy');
const AsciiTable = require("ascii-table");

const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;

const renderVersionTable = require("../actions/docker/monitorDockerContainer_E").renderVersionTable

module.exports.run = run;

async function run() {
    describe("test EnvProxy", () => {
        describe("getDockerInspect_E", () => {
            let proxy;
            before(async () => {
                proxy = await constants.getEnvProxy();
            });
            after(() => {
                if (proxy) {
                    log.debug("closing proxy.");
                    proxy.close();
                    proxy = undefined;
                }
            });
            it("loads a valid inspect", async () => {
                const serviceConfig = await proxy.getServiceInspect_E("kong");
                assert.equal(!!serviceConfig, true);
            });
            it("loads an invalid inspect", async () => {
                const serviceConfig = await proxy.getServiceInspect_E("adriano");
                assert.equal(serviceConfig, undefined)
            });
            it("loads inspect without servicename", async () => {
                const serviceConfig = await proxy.getServiceInspect_E();
                assert.equal(serviceConfig, undefined)
            });
        });
        describe("getTasksOfServices_E | getDeployedVersions_E | getReplicaCount_E", () => {
            const serviceName = "logstash";
            let proxy;
            before(async () => {
                proxy = await constants.getEnvProxy();
            });
            after(() => {
                if (proxy) {
                    log.debug("closing proxy.");
                    proxy.close();
                    proxy = undefined;
                }
            });
            it("fetches tasks", async () => {
                const tasks = await proxy.getTasksOfServices_E(serviceName);
                assert.equal(Array.isArray(tasks), true);
            });
            it("fetches tasks without serviceName", async () => {
                const tasks = await proxy.getTasksOfServices_E()
                    .catch(e => undefined);
                assert.equal(tasks, undefined);
            });
            it("fetches tasks with invalid serviceName", async () => {
                const tasks = await proxy.getTasksOfServices_E("Leonardo_da_Banossi_de_Fiorence");
                assert.deepEqual(tasks, []);
            });
            it("fetches deployed versions", async () => {
                const deployedVersions = await proxy.getDeployedVersions_E(serviceName);
                assert.equal(typeof deployedVersions === 'object', true);

                assert.doesNotThrow(() => {
                    renderVersionTable(deployedVersions);
                })


            });
            it("fetches deployed versions without serviceName", async () => {
                const deployedVersions = await proxy.getDeployedVersions_E()
                    .catch(e => undefined);
                assert.equal(deployedVersions, undefined);
            });
            it("fetches deployed versions with an invalid serviceName", async () => {
                const deployedVersions = await proxy.getDeployedVersions_E("Leonardo_da_Banossi_de_Fiorence");
                assert.deepEqual(deployedVersions, {});
            });
            it("fetches the replicacount", async () => {
                const replicaCount = await proxy.getReplicaCount_E("logstash");
                assert.equal(replicaCount > 0, true)
            });
            it("fetches the replicacount without a serviceName", async () => {
                const replicaCount = await proxy.getReplicaCount_E()
                    .catch(e => undefined);
                assert.equal(replicaCount, undefined)
            });
            it("fetches the replicacount with an invalid serviceName", async () => {
                const replicaCount = await proxy.getReplicaCount_E("Leonardo_da_Banossi_de_Fiorence")
                    .catch(e => undefined)
                assert.equal(replicaCount, undefined)
            })
        })
    })
}
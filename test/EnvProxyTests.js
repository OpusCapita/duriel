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

                const table = renderVersionTable(deployedVersions);

                console.log(table)


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
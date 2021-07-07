const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const assert = require('assert');

const constants = require('./TestConstants');

const monitorDockerContainer_E = require('../actions/docker/monitorDockerContainer_E');
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;

const fileHelper = require("../actions/filehandling/fileHandler");

module.exports.run = run;

async function run() {
    describe("monitoring tests", () => {
        describe("getReplicaCount", () => {
            let proxy;
            before(async () => {
                proxy = await constants.getEnvProxy();
                fileHelper.saveObject2File(constants.task_template, "./task_template.json")
            });
            after(() => {
                require("fs").unlinkSync("./task_template.json");
                if (proxy) {
                    log.debug("closing proxy.");
                    proxy.close();
                    proxy = undefined;
                }
            });
            it("fetches a replicaCount of known service", async () => {
                const config = getBaseConfigObject({ serviceName: "logstash" });
                const replicaCount = await monitorDockerContainer_E.getReplicaCount(config, proxy);
                assert.equal(replicaCount > 0, true);
            });
            it("fetches a replicaCount of known service", async () => {
                const config = getBaseConfigObject({ serviceName: "non-existing" });
                const replicaCount = await monitorDockerContainer_E.getReplicaCount(config, proxy);
                assert.equal(replicaCount > 0, true);
            });
        });
        describe("checkUpdateStatus", async () => {
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
            it("fetches status", async () => {
                const config = getBaseConfigObject({ serviceName: "logstash" });
                const updateStatus = await monitorDockerContainer_E.checkUpdateStatus(config, proxy);
                assert.equal(!!updateStatus.state, true)
            });
            it("fetches status of unknown service", async () => {
                const config = getBaseConfigObject({ serviceName: "KLAUS" });
                const updateStatus = await monitorDockerContainer_E.checkUpdateStatus(config, proxy)
                assert.equal(updateStatus.state, 'failure');
                log.info(updateStatus)
            });
            it("fetches status without serviceName", async () => {
                const config = getBaseConfigObject();
                const updateStatus = await monitorDockerContainer_E.checkUpdateStatus(config, proxy)
                assert.equal(updateStatus.state, 'failure');
                log.info(updateStatus)
            })
        });

        describe("checkCreateStatus", async () => {
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
            it("fetches status", async () => {
                const config = getBaseConfigObject({ serviceName: "logstash" });
                const updateStatus = await monitorDockerContainer_E.checkCreateStatus(config, proxy);
                assert.equal(!!updateStatus.state, true)
            });
            it("fetches status of unknown service", async () => {
                const config = getBaseConfigObject({ serviceName: "KLAUS" });
                const updateStatus = await monitorDockerContainer_E.checkCreateStatus(config, proxy)
                assert.equal(updateStatus.state, 'failure');
                log.info(updateStatus)
            });
            it("fetches status without serviceName", async () => {
                const config = getBaseConfigObject();
                const updateStatus = await monitorDockerContainer_E.checkCreateStatus(config, proxy)
                assert.equal(updateStatus.state, 'failure');
                log.info(updateStatus)
            })
        });
    })
}

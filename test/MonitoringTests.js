const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const assert = require('assert');

const constants = require('./TestConstants');

const monitorDockerContainer_E = require('../actions/docker/monitorDockerContainer_E');
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;


module.exports.run = run;

async function run() {
describe("monitoring tests", ()=>{
    describe("checkUpdateStatus", async () => {
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
        it("fetches status",async () => {
            const config = getBaseConfigObject({serviceName: "logstash"});
            const updateStatus = await monitorDockerContainer_E.checkUpdateStatus(config, proxy);
            assert.equal(updateStatus.state, 'success')
        });
        it("fetches status of unknown service", async () => {
            const config = getBaseConfigObject({serviceName: "KLAUS"});
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
        it("fetches status",async () => {
            const config = getBaseConfigObject({serviceName: "logstash"});
            const updateStatus = await monitorDockerContainer_E.checkCreateStatus(config, proxy);
            assert.equal(updateStatus.state, 'success')
        });
        it("fetches status of unknown service", async () => {
            const config = getBaseConfigObject({serviceName: "KLAUS"});
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
'use strict';
const assert = require("assert");
const extend = require("extend");
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const envInfo = require('../envInfo');
const getBaseConfig = require('../actions/getEnvVariables').getBaseConfigObject
const IntegrationTestHelper = require("../actions/helpers/IntegrationTestHelper");

const devEnvInfo = require("../envInfo").develop;
const constants = require('./TestConstants');

module.exports.run = run;

async function run() {
    describe("checks the healthcheck-data-fetching", () => {
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
        it("run an integrationTest", async () => {
            const config = getBaseConfig(
                extend(true, {},
                    {serviceName: "servicenow-integration"},
                    devEnvInfo));
            await IntegrationTestHelper.runIntegrationTests(config, proxy)
        })
    });
    describe("checks the healthcheck-data-fetching", () => {
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
        it("valid service name", async () => {
            const serviceName = "logstash";
            const config = {serviceName};
            const consulData = await IntegrationTestHelper.getConsulData(config, proxy);

            assert.equal(Array.isArray(consulData.nodes.passing), true)
        });

        it("invalid service name", async () => {
            const serviceName = "kevin";
            const config = {serviceName};
            const consulData = await IntegrationTestHelper.getConsulData(config, proxy);
            assert.equal(Array.isArray(consulData.nodes.passing), true)
        });

        it("no service name", async () => {
            const config = {};
            const consulData = await IntegrationTestHelper.getConsulData(config, proxy);
            assert.equal(consulData, undefined)
        })
    });
    describe("check accessibility", () => {
        const devConfig = getBaseConfig(envInfo.develop);
        const mockConfig = getBaseConfig({public_scheme: "http", public_hostname: 'guukle.com', public_port: '1337'});
        const googleConfig = getBaseConfig({public_scheme: "http", public_hostname: 'google.com', public_port: '80'});


        it("checks the dev system", async () => {
            await IntegrationTestHelper.checkAccessibility(devConfig);
        });

        it("checks a pseudo system", async () => {
            const response = await IntegrationTestHelper.checkAccessibility(mockConfig)
                .catch(e => "ok");
            assert.equal(response, "ok");
        });

        it("checks google", async () => {
            const response = await IntegrationTestHelper.checkAccessibility(googleConfig)
                .catch(e => "ok");
            assert.equal(response, "ok");
        })

    })
}






















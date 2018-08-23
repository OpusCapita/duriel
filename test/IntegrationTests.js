'use strict';
const assert = require("assert");
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const EnvProxy = require('../EnvProxy');

const IntegrationTestHelper = require("../actions/helpers/IntegrationTestHelper");

module.exports.run = run;

async function run() {
    describe("checks the healthcheck-data-fetching", () => {
        let proxy;
        before(async () => {
            log.debug("opening proxy")
            const proxyConfig = require('../envInfo').develop;
            //proxyConfig.admin_user = 'tubbest1';
            proxy = await new EnvProxy().init(proxyConfig)
                .catch(e => log.error(e))
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
    })
}

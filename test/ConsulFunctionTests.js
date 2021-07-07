'use strict';

const assert = require('assert');

const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const EnvProxy = require('../EnvProxy');
const constants = require('./TestConstants');


module.exports.run = run;


async function run() {
    describe("Test consul functions", () => {
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

        const entryName = "Leonardo";
        const entryValue = "delPocko da Fiorence";

        it("adds a kv", async () => {
            await proxy.addKeyValueToConsul(entryName, entryValue);
        });
        it("reads a kv", async () => {
            const fromConsul = await proxy.getKeyValueFromConsul(entryName);
            assert.equal(entryValue, fromConsul);
        });
        it("deletes a kv", async () => {
            await proxy.deleteKeyValueFromConsul(entryName);
            const afterDeletion = await proxy.getKeyValueFromConsul(entryName).
                then(it => "didNotThrow").
                catch(e => undefined);

            assert.equal(afterDeletion, undefined);
        });
        it("requests a non-existing value", async () => {
            const fromConsul = await proxy.getKeyValueFromConsul(entryValue).
                catch(e => "ok");

            assert.equal(fromConsul, "ok");
        })
    })
}

'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const assert = require("assert");

const dockerSecretHelper = require('../actions/helpers/dockerSecretHelper');
const fileHelper = require('../actions/filehandling/fileHandler');
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;

const constants = require('./TestConstants');

module.exports.run = run;

function run() {
    describe("Docker Command Building", () => {
        describe("fetch secrets for creation / removal", () => {
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
            const config = getBaseConfigObject({
                serviceName: "supplier",
                TARGET_ENV: "develop"
            });
            it("does its thing", async () => {
                const secrets = await dockerSecretHelper.getSecretsForDockerCommands(config, proxy);
                assert.equal(secrets instanceof Object, true);
                assert.equal(Array.isArray(secrets.create), true);
                assert.equal(Array.isArray(secrets.remove), true);
            })
        });
        describe("transforms docker secret entries", () => {
            it("transforms all valid kinds", () => {
                const example = {
                    alpha: "i am a string",
                    beta: {value: "i am not encoded"},
                    gamma: {encoding: "base64", value: "aSBhbSBlbmNvZGVk"}
                };
                const expected = {
                    alpha: "i am a string",
                    beta: "i am not encoded",
                    gamma: "i am encoded"
                };
                const transformationResult = dockerSecretHelper.transformSecretEntries(example);
                assert.deepEqual(transformationResult, expected);
            });
            it("transforms nothing", () => {
                const transformationResult = dockerSecretHelper.transformSecretEntries(undefined);
                assert.equal(transformationResult, undefined)
            });
            it("transforms an array", () => {
                assert.throws(
                    () => dockerSecretHelper.transformSecretEntries([]),
                    Error,
                    ""
                );
            });
            it("transforms a string", () => {

                assert.throws(
                    () => dockerSecretHelper.transformSecretEntries("FALSCH!"),
                    Error,
                    ""
                )
            })
        });
    })
}

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
        xdescribe("fetch secrets for creation / removal", () => {
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
            it("fetches add | create | remove", async () => {
                const config = getBaseConfigObject({
                    serviceName: "andariel-monitoring",
                    TARGET_ENV: "develop"
                });
                const secrets = await dockerSecretHelper.getSecretsForDockerCommands(config, proxy);
                assert.equal(secrets instanceof Object, true);
                assert.equal(Array.isArray(secrets.create), true);
                assert.equal(Array.isArray(secrets.remove), true);
                assert.equal(Array.isArray(secrets.add), true);
            });
            it("fetches add | create | remove of a new service", async () => {
                const config = getBaseConfigObject({
                    serviceName: "zweiteSemesterZu",
                    TARGET_ENV: "develop"
                });
                const secrets = await dockerSecretHelper.getSecretsForDockerCommands(config, proxy);
                assert.equal(secrets instanceof Object, true);
                assert.equal(Array.isArray(secrets.create), true);
                assert.equal(Array.isArray(secrets.remove), true);
                assert.equal(Array.isArray(secrets.add), true);
            });
            it("generates the secret params for the update-command", () => {
                const input = {
                    add: ["alpha"],
                    remove: ["beta"],
                    create: [{ name: "gamme", value: "delta" }]
                };
                const expected = "--secret-add alpha --secret-rm beta";
                const actual = dockerSecretHelper.generateUpdateServiceSecretParam(input);

                assert.equal(actual, expected);
            });
            it("generates the secret params for the create-command", () => {
                const input = {
                    add: ["alpha"],
                    remove: ["beta"],
                    create: [{ name: "gamme", value: "delta" }]
                };
                const expected = "--secret alpha";
                const actual = dockerSecretHelper.generateCreateServiceSecretParam(input);

                assert.equal(actual, expected);
            });
            it("create docker secrets", async () => {
                const testingSecretName = "duriel-unit-testing-secret";
                const config = getBaseConfigObject({
                    serviceSecrets: {
                        add: ["alpha"],
                        remove: ["beta"],
                        create: [{ name: testingSecretName, value: "delta" }]
                    }
                });
                await dockerSecretHelper.createDockerSecrets(config, proxy, "createdBy=duriel", "createdFor=unit-testing");
                const afterCreation = await dockerSecretHelper.get(proxy, testingSecretName);

                assert.equal(!!afterCreation, true);

                await dockerSecretHelper.remove(proxy, testingSecretName);
                const afterRemoval = await dockerSecretHelper.get(proxy, testingSecretName).
                    catch(e => "ok");
                assert.equal(afterRemoval, 'ok');
            });
            it("gets an empty task_template", async () => {
                fileHelper.saveObject2File({}, "./task_template.json", true);
                const config = getBaseConfigObject({
                    serviceName: "servicenow-integration",
                    TARGET_ENV: "develop"
                });
                const secrets = await dockerSecretHelper.getSecretsForDockerCommands(config, proxy);
                log.info(secrets)
                assert.equal(secrets instanceof Object, true);
                assert.equal(Array.isArray(secrets.create), true);
                assert.equal(Array.isArray(secrets.remove), true);
                assert.equal(Array.isArray(secrets.add), true);
            })
        });
        describe("transforms docker secret entries", () => {
            it("transforms all valid kinds", () => {
                const example = {
                    alpha: "i am a string",
                    beta: { value: "i am not encoded" },
                    gamma: { encoding: "base64", value: "aSBhbSBlbmNvZGVk" }
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

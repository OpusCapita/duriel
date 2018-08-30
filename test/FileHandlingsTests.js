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
        describe("loads a task_template", () => {
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
        });
        describe("mkdirp", () => {
            const timeStamp = new Date().getTime() + "";
            const path = require("path").resolve("./", timeStamp, "tmp");
            console.log(path)

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
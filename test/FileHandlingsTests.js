const assert = require('assert');
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;
const testConstants = require("./TestConstants");

const fs = require('fs');
const constants = require('./TestConstants');

const fileHelper = require('../actions/filehandling/fileHandler')

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
        it("loading dummy config and comparing with origin", () => {
            const fileContent = fileHelper.loadFile2Object(dummyConfigPath);
            const config = getBaseConfigObject(fileContent);

            const fromFile = config.get(constants.checkedField);
            const fromCode = enhancedSimple.get(constants.checkedField);

            assert.notEqual(fromFile, null);
            assert.notEqual(fromCode, null);
            assert.equal(fromFile, fromCode);
        })
    });
}
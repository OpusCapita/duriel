const assert = require('assert');
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;
const testConstants = require("./TestConstants");

module.exports.run = run;

function run(config) {
    describe("File Handling", () => {
        const enhancedSimple = getBaseConfigObject(testConstants.testConfigFields);
        it("loading dummy config and comparing with origin", () => {
            assert.notEqual(config.get(testConstants.checkedField), null);
            assert.notEqual(enhancedSimple.get(testConstants.checkedField), null);
            assert.equal(config.get(testConstants.checkedField), enhancedSimple.get(testConstants.checkedField));
        })
    });
}
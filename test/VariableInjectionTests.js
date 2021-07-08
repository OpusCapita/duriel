const assert = require("assert");
const variableInjector = require("../actions/filehandling/injectVariables");
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;


const fs = require('fs');
const constants = require('./TestConstants');
module.exports.run = run;

function run() {
    describe('Variable Injection', () => {
        let config;
        before(() => {
            config = getBaseConfigObject(constants.testConfigFields)
        });

        it('injection of a simple variable', () => {
            assert.deepEqual(
                JSON.parse(variableInjector(JSON.stringify(constants.simple), config)),
                constants.successResult
            );
        });
        const input = JSON.stringify(constants.simpleMissingVar);
        it('injection of a missing variable', () => {
            assert.throws(() => variableInjector(input, config), Error, "Error thrown");
        });
        it('injection of a env dependent variable', () => {
            assert.deepEqual(
                JSON.parse(variableInjector(JSON.stringify(constants.withEnvInjection), config)),
                constants.successResult
            );
        });
    });
}

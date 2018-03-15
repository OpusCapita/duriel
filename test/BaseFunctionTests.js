'use strict';
const assert = require("assert");
const fs = require("fs");

const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;
const versionCalculator = require("../actions/calculateVersion");
const targetEnvCalculator = require("../actions/calculateTargetEnv");

const versionFileContent = "1.2.74a";
const circleDevBranch = "develop";
const circleProdBranch = "master";
const circleBuildNum = 42;

module.exports.run = run;

function run() {
    describe("Base Functions", () => {
        it("missing VERSION file", () => {
            assert.throws(() => versionCalculator({}), Error, "no VERSION-File found! exiting!");
        });
        it("calculating version - non-master", async () => {
            writeVersionFile();
            const config = getBaseConfigObject({
                'CIRCLE_BRANCH': circleDevBranch,
                'CIRCLE_BUILD_NUM': circleBuildNum
            });
            const calculatedVersion = versionCalculator(config);
            assert.equal(calculatedVersion, `${versionFileContent}-dev-${circleBuildNum}`);
            deleteVersionFile();
        });
        it("calculating version - non-master", async () => {
            writeVersionFile();
            const config = getBaseConfigObject({
                'CIRCLE_BRANCH': circleProdBranch,
                'CIRCLE_BUILD_NUM': circleBuildNum
            });
            const calculatedVersion = versionCalculator(config);
            assert.equal(calculatedVersion, `${versionFileContent}-rc-${circleBuildNum}`);
            deleteVersionFile();
        });
        it("calculate target env", () => {
            const env = targetEnvCalculator({CIRCLE_BRANCH: circleDevBranch, noise: "42"});
            assert.equal(env, "develop");
        });
        it("branch without env", () => {
            const env = targetEnvCalculator({CIRCLE_BRANCH: "homeless", noise: "Eine Ente ist auch nur ein Pferd"});
            assert.equal(env, "none");
        })
    });
}

function writeVersionFile() {
    fs.writeFileSync("./VERSION", versionFileContent);
}

function deleteVersionFile() {
    fs.unlinkSync("./VERSION");
}
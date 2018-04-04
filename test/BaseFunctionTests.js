'use strict';
const assert = require("assert");
const fs = require("fs");

const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;
const versionCalculator = require("../actions/calculateVersion");
const bumpVersion = require("../actions/bumpVersion");

const versionFileContent = "0.8.15-a";
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
        describe("bump version - functions", () => {
            it("bump - major", async () => {
                const version = "1.2.3-f";
                const expectation = "2.2.3-f";
                const bumpedVersion = await bumpVersion(version, "major", true);
                assert.equal(expectation, bumpedVersion)
            });
            it("bump - minor", async () => {
                const version = "1.2.3-f";
                const expectation = "1.3.3-f";
                const bumpedVersion = await bumpVersion(version, "minor", true);
                assert.equal(expectation, bumpedVersion)
            });
            it("bump - patch", async () => {
                const version = "1.2.3-f";
                const expectation = "1.2.4-f";
                const bumpedVersion = await bumpVersion(version, "patch", true);
                assert.equal(expectation, bumpedVersion)
            });
            it("incorrect version-format", async () => {
                const version = "kaputt-42";
                const bumpedVersion = await bumpVersion(version, "patch", true);
                assert.equal(bumpedVersion, undefined)
            });
            it("incorrect bump-format", async () => {
                const version = "1.1.1";
                const bumpedVersion = await bumpVersion(version, "dropDB", true);
                assert.equal(bumpedVersion, undefined)
            });

        });
        describe("util", () => {
            const helper = require('../actions/util/helper');
            it("flatten simple array", () => {
                const input = [[1], [2]];
                const expected = [1, 2];
                assert.deepEqual(helper.flattenArray(input), expected);
            });
            it("flatten non array", () => {
                assert.throws(() => helper.flattenArray(1), Error, "reduce is not a function");
            });
            it("flatten with different depth", () => {
                const input = [[1], [[2], [[3]]], 4];
                const expected = [1, 2, 3, 4];
                assert.deepEqual(helper.flattenArray(input), expected);
            });
            it("flatten mixed up array and non-array", () => {
                const input = [[1,[2]],3];
                const expected = [1, 2, 3];
                assert.deepEqual(helper.flattenArray(input), expected);
            });
            it("test sleeping", async () => {
                const sleepTime = 1000;
                const start = Date.now();
                await helper.snooze(sleepTime);
                const end = Date.now();
                assert.ok((end - start - 1000) < 100);
            });
        });
    });
}

function writeVersionFile() {
    fs.writeFileSync("./VERSION", versionFileContent);
}

function deleteVersionFile() {
    fs.unlinkSync("./VERSION");
}
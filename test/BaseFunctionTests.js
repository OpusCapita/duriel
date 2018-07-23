'use strict';
const assert = require("assert");
const fs = require("fs");
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;
const versionHelper = require("../actions/helpers/versionHelper");
const calculatEnv = require("../actions/calculateEnv");

const versionFileContent = "0.8.15";
const circleBuildNum = 42;

module.exports.run = run;

function run() {
    describe("Base Functions", () => {
        describe("calculate target-envs", () => {
            it("calculates target-envs", () => {
                assert.equal("develop", calculatEnv.getTargetEnv("develop"));
                assert.equal("develop", calculatEnv.getTargetEnv("nbp"));
                assert.equal("stage", calculatEnv.getTargetEnv("release/delPocko"));
                assert.equal("prod", calculatEnv.getTargetEnv("master"));
                assert.equal(undefined, calculatEnv.getTargetEnv("hotfix/daBanossi"));
                assert.equal(undefined, calculatEnv.getTargetEnv("feature/kevin"));
                assert.equal(undefined, calculatEnv.getTargetEnv("LeonardoDaBanossi"))
            });
        });
        describe("bump version - functions", () => {
            it("bump - major", async () => {
                const version = "1.2.3";
                const expectation = "2.0.0";
                const bumpedVersion = await versionHelper.bumpVersion(version, "major");
                assert.equal(expectation, bumpedVersion)
            });
            it("bump - minor", async () => {
                const version = "1.2.3";
                const expectation = "1.3.0";
                const bumpedVersion = await versionHelper.bumpVersion(version, "minor");
                assert.equal(expectation, bumpedVersion)
            });
            it("bump - patch", async () => {
                const version = "1.2.3";
                const expectation = "1.2.4";
                const bumpedVersion = await versionHelper.bumpVersion(version, "patch");
                assert.equal(expectation, bumpedVersion)
            });
            it("incorrect version-format", async () => {
                const version = "kaputt-42";
                const bumpedVersion = await versionHelper.bumpVersion(version, "patch");
                assert.equal(bumpedVersion, undefined)
            });
            it("incorrect bump-format", async () => {
                const version = "1.1.1";
                const invalidLevel = "LeonardoDeBabanossiDelPocko";
                const bumpedVersion = await versionHelper.bumpVersion(version, invalidLevel).catch(e => "Backpfeife");
                assert.equal(bumpedVersion, "Backpfeife")
            });
        });

        describe("util", () => {
            const helper = require('../actions/helpers/utilHelper');
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
                const input = [[1, [2]], 3];
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
        describe("logger", () => {
            const EpicLogger = require('../EpicLogger');
            it("padding strings", () => {
                const padded = EpicLogger.padLeft("13", '0', 3);
                assert.equal(padded, "013")
            });
            it("padding strings", () => {
                const padded = EpicLogger.padLeft(13, '0', 3);
                assert.equal(padded, "013")
            });
        });
    });
}

function writeVersionFile() {
    fs.writeFileSync("VERSION", versionFileContent);
}

function deleteVersionFile() {
    if (fs.existsSync("VERSION"))
        fs.unlinkSync("VERSION");
}

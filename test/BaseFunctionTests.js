'use strict';
const assert = require("assert");
const fs = require("fs");
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;
const versionHelper = require("../actions/helpers/versionHelper");
const libraryHelper = require("../actions/helpers/libaryHelper");
const calculatEnv = require("../actions/calculateEnv");
const utilHelper = require('../actions/helpers/utilHelper');


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
                assert.equal(undefined, calculatEnv.getTargetEnv("LeonardoDaBanossi"));
            });
        });
        describe("util", () => {
            it("flatten simple array", () => {
                const input = [[1], [2]];
                const expected = [1, 2];
                assert.deepEqual(utilHelper.flattenArray(input), expected);
            });
            it("flatten non array", () => {
                assert.throws(() => utilHelper.flattenArray(1), Error, "reduce is not a function");
            });
            it("flatten with different depth", () => {
                const input = [[1], [[2], [[3]]], 4];
                const expected = [1, 2, 3, 4];
                assert.deepEqual(utilHelper.flattenArray(input), expected);
            });
            it("flatten mixed up array and non-array", () => {
                const input = [[1, [2]], 3];
                const expected = [1, 2, 3];
                assert.deepEqual(utilHelper.flattenArray(input), expected);
            });
            it("test sleeping", async () => {
                const sleepTime = 1000;
                const start = Date.now();
                await utilHelper.snooze(sleepTime);
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
        describe("UtilHelper", () => {
            describe("Get longest string length of an object/array/primitive", () => {
                const input = {
                    a: "1",
                    b: {
                        c: ["22", "333"]
                    },
                    d: "4444"
                };
                it("Gets a valid object", () => {
                    assert.equal(utilHelper.getLongestStringInObject(input), 4);
                });
                it("Gets an array", () => {
                    assert.equal(utilHelper.getLongestStringInObject(["1", 22]), 2);
                });
                it("Gets an primitive", () => {
                    assert.equal(utilHelper.getLongestStringInObject(333), 3);
                });
            })
        })
    });
}

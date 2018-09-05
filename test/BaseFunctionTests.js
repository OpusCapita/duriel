'use strict';
const assert = require("assert");
const fs = require("fs");
const getBaseConfigObject = require("../actions/getEnvVariables").getBaseConfigObject;
const getEnvVariables = require("../actions/getEnvVariables");
const versionHelper = require("../actions/helpers/versionHelper");
const libraryHelper = require("../actions/helpers/libraryHelper");
const calculatEnv = require("../actions/calculateEnv");
const utilHelper = require('../actions/helpers/utilHelper');


module.exports.run = run;

function run() {
    describe("Base Functions", () => {
        describe('calculate repo-path', () => {
            const andarielBranch = "email";
            const masterBranch = "master";
            const outlowBranch = "pocko";

            it("calculates a master path", () => {
                const expected = `OpusCapita/andariel/master`;
                assert.equal(getEnvVariables.calculateRepoPath(andarielBranch, masterBranch), expected);
            });

            it("calculates a outloaw path", () => {
                const expected = `OpusCapita/andariel/${andarielBranch}`;
                assert.equal(getEnvVariables.calculateRepoPath(andarielBranch, outlowBranch), expected);
            })
        });
        describe("getDataBasePassword", () => {
            it("has an ENV and a PW", () => {
                const config = getBaseConfigObject({TARGET_ENV: "develop", SECRET_develop_MYSQL: "ok"});
                const password = getEnvVariables.getDatabasePassword(config);
                assert.equal(password, "ok");
            });
            it("has an ENV and no PW", () => {
                const config = getBaseConfigObject({TARGET_ENV: "develop"});
                const password = getEnvVariables.getDatabasePassword(config);
                assert.equal(password, undefined);
            });
            it("has no ENV and a PW", () => {
                const config = getBaseConfigObject({SECRET_develop_MYSQL: "ok"});
                const password = getEnvVariables.getDatabasePassword(config);
                assert.equal(password, "none");
            });
        });
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
            describe("making arrayentries unique", () => {
                it("gets a string-array", () => {
                    const input = ['a', 'b', 'a'];
                    const output = ['a', 'b'];
                    assert.deepEqual(utilHelper.getUniqueArray(input), output);
                });
                it("gets a number-array", () => {
                    const input = [1, 2, 1];
                    const output = [1, 2];
                    assert.deepEqual(utilHelper.getUniqueArray(input), output);
                });
                it("gets a array with undefined", () => {
                    const input = ['a', 'b', 'a', undefined];
                    const output = ['a', 'b'];
                    assert.deepEqual(utilHelper.getUniqueArray(input), output);
                });
                it("gets a mixed-array", () => {
                    const input = [1, '1', 2];
                    const output = ['1', '2'];
                    assert.deepEqual(utilHelper.getUniqueArray(input), output);
                });
                it("get nothing", () => {
                    assert.deepEqual(utilHelper.getUniqueArray(), []);
                })
            });
            it("test sleeping", async () => {
                const sleepTime = 1000;
                const start = Date.now();
                await utilHelper.snooze(sleepTime);
                const end = Date.now();
                assert.ok((end - start - 1000) < 100);
            });
        });
        describe("array grouping", () => {
            const defaultInput = [
                {a: 'a', b: 'b'},
                {a: 'c', b: 'b'}
            ];
            const defaultExpected = {
                b: [
                    {a: 'a', b: 'b'},
                    {a: 'c', b: 'b'}
                ]
            };
            it("groups by a key", () => {
                assert.deepEqual(utilHelper.groupBy(defaultInput, (input) => input.b), defaultExpected);
            });
            it("misses a function", () => {
                assert.throws(() => utilHelper.groupBy(defaultInput))
            });
            it("misses all params", () => {
                assert.throws(() => utilHelper.groupBy())
            });
            it("gets a non array", () => {
                assert.throws(() => utilHelper.groupBy("pocko", () => "del"))
            });
        });

        describe("array intersect", () => {
            const a = [1, 2, 3];
            const b = [2, 4, {a: 2}];
            const c = [1, 3, [4]];
            const d = [1, 3, 6, [4]];

            it("intersects two", () => {
                const expected = [2];
                assert.deepEqual(utilHelper.arrayIntersect(a, b), expected);
            });

            it("intersects three with empty result", () => {
                const expected = [];
                assert.deepEqual(utilHelper.arrayIntersect(a, b, c), expected)
            });

            it("intersect three", () => {
                const expected = [1, 3];
                assert.deepEqual(utilHelper.arrayIntersect(a, c, d), expected)
            });
            it("intersect with deep equals", () => {
                const expected = [1, 3, [4]];
                assert.deepEqual(utilHelper.arrayIntersect(c, d), expected)

            })
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
        });
        describe("padding", () => {
            it("pads left", () => {
                assert.equal(
                    utilHelper.padLeft("Hi", "0", 5),
                    "000Hi"
                );
                assert.equal(
                    utilHelper.padLeft("23", "0", 5),
                    "00023"
                );
                assert.equal(
                    utilHelper.padLeft("AlphaOmega", "0", 5),
                    "AlphaOmega"
                );
                assert.equal(
                    utilHelper.padLeft(24, 0, 5),
                    "00024"
                );
                assert.equal(
                    utilHelper.padLeft(undefined, 0, 5),
                    "00000"
                );
            });
            it("pads right", () => {
                assert.equal(
                    utilHelper.padRight("Hi", "0", 5),
                    "Hi000"
                );
                assert.equal(
                    utilHelper.padRight("23", "0", 5),
                    "23000"
                );
                assert.equal(
                    utilHelper.padRight("AlphaOmega", "0", 5),
                    "AlphaOmega"
                );
                assert.equal(
                    utilHelper.padRight(24, 0, 5),
                    "24000"
                );
                assert.equal(
                    utilHelper.padRight(undefined, 0, 5),
                    "00000"
                );
            });
            it("pads right", () => {
                assert.equal(
                    utilHelper.padBoth("Hi", "0", 6),
                    "00Hi00"
                );
                assert.equal(
                    utilHelper.padBoth("23", "0", 6),
                    "002300"
                );
                assert.equal(
                    utilHelper.padBoth("AlphaOmega", "0", 5),
                    "AlphaOmega"
                );
                assert.equal(
                    utilHelper.padBoth(24, 0, 6),
                    "002400"
                );
                assert.equal(
                    utilHelper.padBoth(undefined, 0, 5),
                    "00000"
                );
            })
        });
        describe("isEqual", () => {
            it("compares numbers", () => {
                assert.equal(
                    utilHelper.isEqual(2, 2),
                    true
                );
                assert.equal(
                    utilHelper.isEqual(2, 3),
                    false
                )
            });
            it("compares strings", () => {
                assert.equal(
                    utilHelper.isEqual("2a", "2a"),
                    true
                );
                assert.equal(
                    utilHelper.isEqual("2a", "3b"),
                    false
                )
            });
            it("compares array", () => {
                assert.equal(
                    utilHelper.isEqual(["2a"], ["2a"]),
                    true
                );
                assert.equal(
                    utilHelper.isEqual(["2a"], ["3b"]),
                    false
                )
            });
            it("compares objects", () => {
                assert.equal(
                    utilHelper.isEqual({a: "2a"}, {a: "2a"}),
                    true
                );
                assert.equal(
                    utilHelper.isEqual({a: "2a"}, {a: "3a"}),
                    false
                );
                assert.equal(
                    utilHelper.isEqual({a: "2a"}, {b: "2a"}),
                    false
                )
            })
        })
    });
}

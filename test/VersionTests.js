'use strict';
const assert = require("assert");
const versionHelper = require("../actions/helpers/versionHelper");

const getBaseConfig = require('../actions/getEnvVariables').getBaseConfigObject;

function run() {
    describe("version - bump", () => {
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
    describe("version - bump prod", () => {
        // these are fixed commits with parents with specific tags.
        // tags gone? test will fail
        // commits gone? test will fail
        const hotfixConfig = getBaseConfig({CIRCLE_SHA1: "46156f351bae4bf26d052e56d6da3d6d80fb5137"});
        const releaseConfig = getBaseConfig({CIRCLE_SHA1: "4f3a15bd48bb09b8fae77256657fa61234d1602f"});

        it("bumps a hotfix version", async () => {
            const version = await versionHelper.bumpProdVersion(hotfixConfig);
            assert.equal(!!version, true)
        });
        it("bumps a release version", async () => {
            const version = await versionHelper.bumpProdVersion(releaseConfig);
            assert.equal(!!version, true)
        });
    });
    describe("main-version - compare", () => {
        const small = "0.0.1";
        const big = "1.0.0";
        const broken = "Leonardo.0.da-Banossi";

        it("is greater", () => {
            assert.equal(versionHelper.compareVersion(big, small) > 0, true)
            assert.equal(versionHelper.compareVersion(`^${big}`, small) > 0, true);
            assert.equal(versionHelper.compareVersion(`~${big}`, small) > 0, true);
        });
        it("is lower", () => {
            assert.equal(versionHelper.compareVersion(small, big) < 0, true)
            assert.equal(versionHelper.compareVersion(small, `^${big}`) < 0, true);
            assert.equal(versionHelper.compareVersion(small, `~${big}`) < 0, true);
        });
        it("is equal", () => {
            assert.equal(versionHelper.compareVersion(big, big) === 0, true)
            assert.equal(versionHelper.compareVersion(big, `~${big}`) === 0, true)
            assert.equal(versionHelper.compareVersion(big, `^${big}`) === 0, true)
        });
        it("is broken", () => {
            assert.throws(() => versionHelper.compareVersion(broken, small), Error, "")
        });
        it("is broken again", () => {
            assert.throws(() => versionHelper.compareVersion(small, broken), Error, "")
        });
        it("has a crazy prefixes", () => {

            assert.equal(versionHelper.compareVersion(`^${big}`, small) > 0, true);
            assert.equal(versionHelper.compareVersion(`~${big}`, small) > 0, true);
        })
    });
    describe("dev-version - compare", () => {
        const small = "0.0.1-dev-123";
        const big = "1.0.0-rc-123";
        const broken = "Leonardo.0.da-Banossi";

        it("is greater", () => {
            assert.equal(versionHelper.compareVersion(big, small) > 0, true)
        });
        it("is lower", () => {
            assert.equal(versionHelper.compareVersion(small, big) < 0, true)
        });
        it("is equal", () => {
            assert.equal(versionHelper.compareVersion(big, big) === 0, true)
        });
        it("is broken", () => {
            assert.throws(() => versionHelper.compareVersion(broken, small), Error, "")
        });
        it("is broken again", () => {
            assert.throws(() => versionHelper.compareVersion(small, broken), Error, "")
        });
    });
    describe("version dependency merging", () => {
        const a = {
            supplier: "0.0.1",
            tnt: "0.0.2-dev-12"
        };
        const b = {
            supplier: "1.0.0",
            dummy: "2.2.1-hf-123"
        };
        it("merges with higher", () => {
            const result = {
                supplier: "1.0.0",
                tnt: "0.0.2-dev-12",
                dummy: "2.2.1-hf-123"
            };
            const calculated = versionHelper.mergeVersionDependencies(true, a, b);
            assert.deepEqual(result, calculated);
        });
        it("merges with lower", () => {
            const result = {
                supplier: "0.0.1",
                tnt: "0.0.2-dev-12",
                dummy: "2.2.1-hf-123"
            };
            const calculated = versionHelper.mergeVersionDependencies(false, a, b);
            assert.deepEqual(result, calculated);
        });
        it("merges with broken versions", () => {
            assert.throws(() => versionHelper.mergeVersionDependencies(false, "kevin", b), Error, "");
        })
    });
    describe("validate version", () => {
        const a = "1.0.0";
        const b = "1.0.0-dev-1";
        const c = "ole ola olalala";

        it("gets a valid main-version", () => {
            assert.equal(versionHelper.validateVersion(a), true);
        });
        it("gets a valid dev-version", () => {
            assert.equal(versionHelper.validateVersion(b), true);
        });
        it("get a broken version", () => {
            assert.equal(versionHelper.validateVersion(c), false);
        });
    });
}

module.exports.run = run;

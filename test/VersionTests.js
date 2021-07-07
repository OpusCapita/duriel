'use strict';
const assert = require("assert");
const versionHelper = require("../actions/helpers/versionHelper");
const gitHelper = require("../actions/helpers/gitHelper");

const getBaseConfig = require('../actions/getEnvVariables').getBaseConfigObject;

function run() {
    describe("calculateImageTag", () => {
        it("dev-tag", async () => {
            const config = getBaseConfig({ TARGET_ENV: "develop", CIRCLE_BRANCH: "develop", CIRCLE_BUILD_NUM: 1 });
            const tag = await versionHelper.calculateImageTag(config);
            assert.equal(tag.includes("-dev-1"), true);
        });
        it("rc-tag", async () => {
            const config = getBaseConfig({ TARGET_ENV: "stage", CIRCLE_BRANCH: "release/alpha", CIRCLE_BUILD_NUM: 2 });
            const tag = await versionHelper.calculateImageTag(config);
            assert.equal(tag.includes("-rc-2"), true);
        });
        it("main-tag", async () => {
            const config = getBaseConfig({ TARGET_ENV: "prod", CIRCLE_BRANCH: "master", CIRCLE_BUILD_NUM: 3 });
            const tag = await versionHelper.calculateImageTag(config);
            assert.equal(versionHelper.validateVersion(tag), true)
        });
        it("feature-tag", async () => {
            const config = getBaseConfig({ TARGET_ENV: undefined, CIRCLE_BRANCH: "feature/beta", CIRCLE_BUILD_NUM: 4 });
            const tag = await versionHelper.calculateImageTag(config);
            assert.equal(tag.includes("-dev-4"), true);
        });
        it("law-breaker-tag", async () => {
            const config = getBaseConfig({
                TARGET_ENV: undefined,
                CIRCLE_BRANCH: "constantinos/pockos",
                CIRCLE_BUILD_NUM: 5
            });
            const tag = await versionHelper.calculateImageTag(config);
            assert.equal(tag.includes("-dev-5"), true);
        });
    });
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
        const hotfixConfig = getBaseConfig({ CIRCLE_SHA1: "46156f351bae4bf26d052e56d6da3d6d80fb5137" });
        const releaseConfig = getBaseConfig({ CIRCLE_SHA1: "4f3a15bd48bb09b8fae77256657fa61234d1602f" });
        const majorConfig = getBaseConfig({ CIRCLE_SHA1: "4f3a15bd48bb09b8fae77256657fa61234d1602f", major_release: "ole" })

        it("bumps a hotfix version", async () => {
            const currentVersion = await gitHelper.getMainVersionTags().then(versions => versions[0]);

            const version = await versionHelper.bumpProdVersion(hotfixConfig);
            const expected = await versionHelper.bumpVersion(currentVersion, "patch");
            assert.equal(!!version, true);
            assert.equal(version, expected);
        });
        it("bumps a release version", async () => {
            const currentVersion = await gitHelper.getMainVersionTags().then(versions => versions[0]);

            const version = await versionHelper.bumpProdVersion(releaseConfig);
            const expected = await versionHelper.bumpVersion(currentVersion, "minor");
            assert.equal(!!version, true);
            assert.equal(version, expected);
        });
        it("bumps a major version", async () => {
            const currentVersion = await gitHelper.getMainVersionTags().then(versions => versions[0]);

            const version = await versionHelper.bumpProdVersion(majorConfig);
            const expected = await versionHelper.bumpVersion(currentVersion, "major");
            assert.equal(!!version, true);
            assert.equal(version, expected);
        });
    });
    describe("main-version - compare", () => {
        const small = "0.0.1";
        const mid = "0.1.0";
        const big = "1.0.0";
        const broken = "Leonardo.0.da-Banossi";

        it("is greater", () => {
            assert.equal(versionHelper.compareVersion(big, small) > 0, true)
            assert.equal(versionHelper.compareVersion(big, mid) > 0, true)
            assert.equal(versionHelper.compareVersion(mid, small) > 0, true)
            assert.equal(versionHelper.compareVersion(`^${big}`, small) > 0, true);
            assert.equal(versionHelper.compareVersion(`~${big}`, small) > 0, true);
        });
        it("is lower", () => {
            assert.equal(versionHelper.compareVersion(small, big) < 0, true);
            assert.equal(versionHelper.compareVersion(small, mid) < 0, true);
            assert.equal(versionHelper.compareVersion(mid, big) < 0, true);
            assert.equal(versionHelper.compareVersion(small, `^${big}`) < 0, true);
            assert.equal(versionHelper.compareVersion(small, `~${big}`) < 0, true);
        });
        it("is equal", () => {
            assert.equal(versionHelper.compareVersion(small, small) === 0, true);
            assert.equal(versionHelper.compareVersion(mid, mid) === 0, true);
            assert.equal(versionHelper.compareVersion(big, big) === 0, true);
            assert.equal(versionHelper.compareVersion(big, `~${big}`) === 0, true);
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
        });
        it("misses a parameter", () => {
            assert.equal(versionHelper.compareVersion(undefined, small) < 0, true);
            assert.equal(versionHelper.compareVersion(small, undefined) > 0, true);
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

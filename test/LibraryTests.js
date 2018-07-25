'use strict';
const assert = require("assert");
const libraryHelper = require("../actions/helpers/libaryHelper");

const dummyPackageJson = {
    "dependencies": {
        "delPocko": "^0.17.1",
    },
    "devDependencies": {
        "mocha": "^5.0.4",
        "leonardo": "3.2.1",
        "daBanossi": "4.5.6"
    }
};


module.exports.run = function () {
    describe("library - fetching", () => {
        it("loads a the packageJson", () => {
            assert.equal(libraryHelper.getLibraryVersion("kevin"), undefined);
        });
        it("loads a valid dependency", () => {
            assert.equal(libraryHelper.getLibraryVersion("delPocko", dummyPackageJson), "^0.17.1");
        });
        it("loads a valid dev-dependency", () => {
            assert.equal(libraryHelper.getLibraryVersion("leonardo", dummyPackageJson), "3.2.1");
        });
        it("loads a invalid dependency", () => {
            assert.equal(libraryHelper.getLibraryVersion("kevin", dummyPackageJson), undefined);
        });
    })
};

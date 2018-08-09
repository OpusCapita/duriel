'use strict';
const assert = require("assert");
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const fs = require('fs')

const getBaseConfig = require('../actions/getEnvVariables').getBaseConfigObject;
const versionValidator = require('../actions/versionValidator');
const libraryHelper = require("../actions/helpers/libaryHelper");
const EnvProxy = require('../EnvProxy');
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

module.exports.run = run;

async function run() {
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
    });
    describe("dependency fetching", () => {
        describe("service dependencies", () => {
            const taskTemplate = {
                default: {
                    serviceDependencies: {
                        sequelize: "4.4.4",
                        extend: "1.1.1"
                    }
                },
                develop: {
                    serviceDependencies: {
                        sequelize: "2.2.2"
                    }
                }
            };

            it("fetches without env-settings", () => {
                const config = {
                    TARGET_ENV: "delPocko"
                };
                const expected = {
                    sequelize: "4.4.4",
                    extend: "1.1.1"
                };
                assert.deepEqual(libraryHelper.fetchServiceVersionDependencies(config, taskTemplate), expected)
            });

            it("fetches without env-settings", () => {
                const config = {
                    TARGET_ENV: "develop"
                };
                const expected = {
                    sequelize: "2.2.2",
                    extend: "1.1.1"
                };
                assert.deepEqual(libraryHelper.fetchServiceVersionDependencies(config, taskTemplate), expected)
            });

        });
        describe("library dependencies ", async () => {
        })
    });
    describe("dependency checking", () => {
        describe("service dependencies", () => {
            const deployed = {
                sequelize: "2.2.2",
                extend: "1.1.1"
            };

            it("bulls eye check", () => {
                const expected = {
                    sequelize: "2.2.2",
                    extend: "1.1.1"
                };
                assert.equal(libraryHelper.checkServiceDependencies(expected, deployed).success, true);
            });
            it("passing check", () => {
                const expected = {
                    sequelize: "2.2.2",
                    extend: "0.5.1"
                };
                assert.equal(libraryHelper.checkServiceDependencies(expected, deployed).success, true);
            });
            it("invalid version deployed", () => {
                const expected = {
                    sequelize: "2.2.2",
                    extend: "2.1.1"
                };
                const result = libraryHelper.checkServiceDependencies(expected, deployed);
                assert.equal(result.success, false);
            });
            it("missing service", () => {
                const expected = {
                    sequelize: "2.2.2",
                    delPockoLib: "1.2.3"
                };
                const result = libraryHelper.checkServiceDependencies(expected, deployed);
                assert.equal(result.success, false);
            })
        });
        describe("check dummy", async () => {
            it("checks and has success", async () => {
                const proxyConfig = require('../envInfo').develop;
                proxyConfig.admin_user = 'tubbest1';
                const proxy = await new EnvProxy().init(proxyConfig);

                const config = getBaseConfig({TARGET_ENV: 'develop'});
                fs.writeFileSync("task_template.json", JSON.stringify({
                    default: {
                        serviceDependencies: {
                            dummy: "0.0.0"
                        }
                    }
                }));
                let successCheck = await versionValidator.validateVersionDependencies(config, proxy);
                proxy.close();
                assert.equal(successCheck.serviceVersionCheck.success, true);
            });

            it("checks and has success", async () => {
                const proxyConfig = require('../envInfo').develop;
                proxyConfig.admin_user = 'tubbest1';
                const proxy = await new EnvProxy().init(proxyConfig);

                const config = getBaseConfig({TARGET_ENV: 'develop'});
                fs.writeFileSync("task_template.json", JSON.stringify({
                    default: {
                        serviceDependencies: {
                            dummy: "999.999.999"
                        }
                    }
                }));

                let successCheck = await versionValidator.validateVersionDependencies(config, proxy)
                proxy.close();
                assert.equal(successCheck.serviceVersionCheck.success, false);
            });
            it("renders the results", () => {
                const checkResult = {
                    "serviceVersionCheck": {
                        "errors": [
                            {
                                "service": "andariel",
                                "expected": "2.0.0",
                                "deployed": "1.0.0-dev-261"
                            },
                            {
                                "service": "andariel-monitoring",
                                "expected": "2.0.0",
                                "deployed": "1.0.0-dev-2613232"
                            }
                        ],
                        "passing": [
                            {
                                "service": "dummy",
                                "expected": "0.0.0",
                                "deployed": "1.0.0-dev-261",

                            }, {
                                "service": "tnt",
                                "expected": "0.0.0",
                                "deployed": "0.2.5-dev-261"
                            }
                        ],
                        "success": false
                    }
                };
                assert.doesNotThrow(() => versionValidator.renderVersionValidationResult(checkResult))
            })
        })
    });
}

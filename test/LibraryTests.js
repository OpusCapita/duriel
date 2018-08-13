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
    describe("Dependency Tests", () => {
        let proxy;
        before(async () => {
            const proxyConfig = require('../envInfo').develop;
            proxyConfig.admin_user = 'tubbest1';
            proxy = await new EnvProxy().init(proxyConfig);
        });

        after(() => {
            if (proxy) {
                log.info("closing proxy.");
                proxy.close();
                proxy = undefined;
            }
        });

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
                it("checks and has no dependencies", async () => {
                    const config = getBaseConfig({TARGET_ENV: 'develop'});
                    fs.writeFileSync("task_template.json", JSON.stringify({}));
                    let successCheck = await versionValidator.validateVersionDependencies(config, proxy);
                    assert.equal(successCheck.success, true);
                });
                it("checks and has success", async () => {
                    const config = getBaseConfig({TARGET_ENV: 'develop'});
                    fs.writeFileSync("task_template.json", JSON.stringify({
                        default: {
                            serviceDependencies: {
                                dummy: "0.0.0"
                            }
                        }
                    }));
                    let successCheck = await versionValidator.validateVersionDependencies(config, proxy);
                    assert.equal(successCheck.success, true);
                    assert.doesNotThrow(() => versionValidator.renderVersionValidationResult(successCheck))
                });

                it("checks and failes", async () => {
                    const config = getBaseConfig({TARGET_ENV: 'develop'});
                    fs.writeFileSync("task_template.json", JSON.stringify({
                        default: {
                            serviceDependencies: {
                                dummy: "999.999.999"
                            }
                        }
                    }));

                    let successCheck = await versionValidator.validateVersionDependencies(config, proxy);
                    assert.equal(successCheck.success, false);
                    assert.doesNotThrow(() => versionValidator.renderVersionValidationResult(successCheck))
                });
                it("renders the results", () => {
                    const checkResult = {
                        "validations": [
                            {
                                "name": "ServiceValidation",
                                "errors": [
                                    {
                                        "service": "dummy",
                                        "expected": "999.999.999",
                                        "deployed": "1.0.0-dev-261"
                                    }
                                ],
                                "passing": [
                                    {
                                        "service": "logstash",
                                        "expected": "0.999.999",
                                        "deployed": "1.0.0-dev-261"
                                    }
                                ]
                            }
                        ],
                        "success": false
                    };
                    assert.doesNotThrow(() => versionValidator.renderVersionValidationResult(checkResult))
                });
            });
            describe("Validation conclusion", () => {
                it("gets a failure", () => {
                    const validations = [
                        {
                            "name": "ServiceValidation",
                            "errors": [
                                {
                                    "service": "dummy",
                                    "expected": "999.999.999",
                                    "deployed": "1.0.0-dev-261"
                                }
                            ],
                            "passing": []
                        }
                    ];
                    assert.equal(versionValidator.concludeValidationResult(validations), false);
                });
                it("gets a passing result", () => {
                    const validations = [
                        {
                            "name": "ServiceValidation",
                            "passing": [
                                {
                                    "service": "dummy",
                                    "expected": "999.999.999",
                                    "deployed": "1.0.0-dev-261"
                                }
                            ],
                            "errors": []
                        }
                    ];
                    assert.equal(versionValidator.concludeValidationResult(validations), true);
                })
            })
        });
        describe("Library loading", async () => {
            const packageJson = {
                "dependencies": {
                    "sequelize": "0.0.0",
                    "@opuscapita/config": "1.0.0"
                }
            };
            it("loads valid dependencies", async () => {
                const serviceDependencies = {
                    "servicenow-integration": "0.0.0",
                    "email": "0.0.0"
                };
                const result = await libraryHelper.checkLibraryDependencies({}, proxy, serviceDependencies, packageJson);
                assert.equal(result.errors.length, 0);
                assert.equal(result.passing.length, 1);
            });
            it("loads from a missing service", async () => {
                const serviceDependencies = {
                    "servicenow-integration": "0.0.0",
                    "delPocko": "2.3.4"
                };
                const result = await libraryHelper.checkLibraryDependencies({}, proxy, serviceDependencies, packageJson);
                assert.equal(result.errors.length > 0, true);
            });

            it("loads invalid library dependency", async () => {
                const serviceDependencies = {
                    "delPocko": "0.8.15"
                };
                const packageJson = {
                    "dependencies": {
                        "sequelize": "0.0.0"
                    }
                };
                const result = await libraryHelper.checkLibraryDependencies({}, proxy, serviceDependencies, packageJson);
                assert.equal(result.errors.length > 0, true);
            });

            it("renders library check results", async () => {
                const checkResult = {
                    "validations": [
                        {
                            "name": "ServiceValidation",
                            "errors": [
                                {
                                    "service": "dummy",
                                    "expected": "999.999.999",
                                    "deployed": "1.0.0-dev-261"
                                }
                            ],
                            "passing": [
                                {
                                    "service": "logstash",
                                    "expected": "0.999.999",
                                    "deployed": "1.0.0-dev-261"
                                }
                            ]
                        },
                        {
                            "name": "LibraryValidation",
                            "errors": [
                                {
                                    "library": "lodash",
                                    "expected": "999.999.999",
                                    "installed": "1.0.0-dev-261",
                                    "service": "dummy",
                                    "reason": "Do not use lodash!"
                                }
                            ],
                            "passing": [
                                {
                                    "library": "@opuscapita/config",
                                    "expected": "0.0.0",
                                    "installed": "1.0.0",
                                    "service": "servicenow-integration",
                                    "reason": "-"
                                }
                            ]
                        }
                    ],
                    "success": false
                };
                assert.doesNotThrow(async () => {
                    log.info(await versionValidator.renderVersionValidationResult(checkResult))
                })
            });
        });
        /**describe("Does a complete check", () => {

            it("runs all", async () => {
                fs.writeFileSync("task_template.json", JSON.stringify({
                    default: {
                        serviceDependencies: {
                            dummy: "0.0.0",
                            "servicenow-integration": "0.0.0"
                        }
                    }
                }));

                const output = await versionValidator.checkVersionDependencies({}, proxy)
                    .catch(e => true);


                fs.unlinkSync("task_template.json");
            })
        })*/
    });
}

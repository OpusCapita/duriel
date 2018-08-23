'use strict';
const assert = require("assert");
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const fs = require('fs');

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
                const taskTemplate = {
                    default: {
                        serviceDependencies: {
                            dummy: "4.4.4"
                        }
                    },
                    develop: {
                        serviceDependencies: {
                            dummy: "2.2.2"
                        }
                    }
                };

                it("fetches without env-settings", () => {
                    const config = {
                        TARGET_ENV: "delPocko"
                    };
                    const expected = {
                        dummy: "4.4.4"
                    };
                    assert.deepEqual(libraryHelper.fetchServiceVersionDependencies(config, taskTemplate), expected)
                });

                it("fetches with env-settings", () => {
                    const config = {
                        TARGET_ENV: "develop"
                    };
                    const expected = {
                        dummy: "2.2.2"
                    };
                    assert.deepEqual(libraryHelper.fetchServiceVersionDependencies(config, taskTemplate), expected)
                });

                describe("library dependencies ", async () => {
                })
            });
            describe("dependency checking", () => {
                describe("service dependencies", () => {
                    const deployed = {
                        dummy: "2.2.2",
                        sirius: "1.1.1"
                    };

                    it("bulls eye check", () => {
                        const expected = {
                            dummy: "2.2.2",
                            sirius: "1.1.1"
                        };

                        const result = libraryHelper.checkService2ServiceDependencies(expected, deployed)
                        const renderingBase = {validations: [result]};
                        log.info(versionValidator.renderVersionValidationResult(renderingBase));

                        assert.doesNotThrow(() => {
                            assert.equal(result.success(), true);
                            log.debug(versionValidator.renderVersionValidationResult(renderingBase));
                        });

                    });
                    it("passing check", () => {
                        const expected = {
                            dummy: "2.2.2",
                            sirius: "0.5.1"
                        };
                        assert.equal(libraryHelper.checkService2ServiceDependencies(expected, deployed).success(), true);
                    });
                    it("invalid version deployed", () => {
                        const expected = {
                            dummy: "2.2.2",
                            sirius: "2.1.1"
                        };
                        const result = libraryHelper.checkService2ServiceDependencies(expected, deployed);
                        assert.equal(result.success(), false);
                    });
                    it("missing service", () => {
                        const expected = {
                            dummy: "2.2.2",
                            delPockoLib: "1.2.3"
                        };
                        const result = libraryHelper.checkService2ServiceDependencies(expected, deployed);
                        assert.equal(result.success(), false);
                    })
                    it("checking consul exception", () => {
                        const expected = {
                            dummy: "2.2.2",
                            delPockoLib: "1.2.3"
                        };
                        const result = libraryHelper.checkService2ServiceDependencies(expected, deployed);
                        assert.equal(result.success(), false);
                    })
                });
                describe("check dummy", async () => {
                    let proxy
                    before(async () => {
                        const proxyConfig = require('../envInfo').develop;
                        //proxyConfig.admin_user = 'tubbest1';
                        proxy = await new EnvProxy().init(proxyConfig)
                            .catch(e => log.error(e))
                    });

                    after(() => {
                        if (proxy) {
                            log.debug("closing proxy.");
                            proxy.close();
                            proxy = undefined;
                        }
                    })


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
                        log.info(successCheck);
                        assert.equal(successCheck.success, true);
                        assert.doesNotThrow(() => log.info(versionValidator.renderVersionValidationResult(successCheck)));
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
                                new libraryHelper.CheckEntryHolder(
                                    "ServiceValidation",
                                    [new libraryHelper.ServiceCheckEntry('dummy', '999.999.999', '1.0.0')],
                                    [new libraryHelper.ServiceCheckEntry('lodash', '0.999.999', '1.0.0')]
                                )
                            ]
                        };
                        assert.doesNotThrow(() => versionValidator.renderVersionValidationResult(checkResult))
                    });
                });
                describe("Check functions of classes", () => {
                    const entry = new libraryHelper.ServiceCheckEntry('lodash', '0.999.999', '1.0.0')
                    it("success", () => {
                        assert.doesNotThrow(() => {
                            const holder = new libraryHelper.CheckEntryHolder("Kevin");
                            assert.equal(holder.success(), true);
                            holder.addPassingEntry(entry);
                            assert.equal(holder.success(), true);
                        })
                    });
                    it("failes", () => {
                        const holder = new libraryHelper.CheckEntryHolder("Kevin2");
                        assert.equal(holder.success(), true);
                        holder.addFailingEntry(entry);
                        assert.equal(holder.success(), false);
                    });
                    it("gets wrong type", () => {
                        const holder = new libraryHelper.CheckEntryHolder("Kevin2");
                        assert.throws(() => {
                            holder.addPassingEntry("    wlekjfjbl   2ee");
                        });
                        assert.throws(() => {
                            holder.addFailingEntry("    wlekjfjbl   2ee");
                        });
                        assert.equal(holder.success(), true);
                    })
                });
                describe("Validation conclusion", () => {
                    it("gets a failure", () => {
                        const validations = [
                            new libraryHelper.CheckEntryHolder(
                                "ServiceValidation",
                                [],
                                [new libraryHelper.ServiceCheckEntry('dummy', '999.999.999', '1.0.0')]
                            )
                        ];
                        assert.equal(versionValidator.concludeValidationResult(validations), false);
                    });
                    it("gets a passing result", () => {
                        const validations = [
                            new libraryHelper.CheckEntryHolder(
                                "ServiceValidation",
                                [new libraryHelper.ServiceCheckEntry('dummy', '999.999.999', '1.0.0')],
                                []
                            )
                        ];
                        assert.equal(versionValidator.concludeValidationResult(validations), true);
                    })
                })
            });
            describe("Library loading", async () => {
                let proxy
                before(async () => {
                    const proxyConfig = require('../envInfo').develop;
                    //proxyConfig.admin_user = 'tubbest1';
                    proxy = await new EnvProxy().init(proxyConfig)
                        .catch(e => log.error(e))
                });

                after(() => {
                    if (proxy) {
                        log.debug("closing proxy.");
                        proxy.close();
                        proxy = undefined;
                    }
                })

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
                    assert.equal(result.failing.length, 0);
                    assert.equal(result.passing.length, 1);
                });
                it("loads from a missing service", async () => {
                    const serviceDependencies = {
                        "servicenow-integration": "0.0.0",
                        "delPocko": "2.3.4"
                    };
                    const result = await libraryHelper.checkLibraryDependencies({}, proxy, serviceDependencies, packageJson);
                    assert.equal(result.failing.length > 0, true);
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
                    assert.equal(result.failing.length > 0, true);
                });

                it("renders library check results", async () => {
                    const checkResult = {
                        "validations": [
                            new libraryHelper.CheckEntryHolder(
                                "Test",
                                [new libraryHelper.ServiceCheckEntry('dummy', '999.999.999', '1.0.0')],
                                [new libraryHelper.ServiceCheckEntry('sequelize', '0.999.999', '1.0.0')]
                            ),
                            new libraryHelper.CheckEntryHolder(
                                "Library2ServiceValidation",
                                [new libraryHelper.ServiceCheckEntry('dummy', '999.999.999', '1.0.0', 'service-client')],
                                [new libraryHelper.ServiceCheckEntry('sequelize', '0.999.999', '1.0.0', 'web-init')]
                            ),
                            new libraryHelper.CheckEntryHolder(
                                "Library2LibraryValidation",
                                [new libraryHelper.LibraryCheckEntry('lodash', '999.999.999', '1.0.0-dev-261', 'dummy', 'do not use this!')],
                                [new libraryHelper.LibraryCheckEntry('@opuscapita/config', '0.0.0', '1.0.0', 'servicenow-integration', '-')]
                            )
                        ]
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
        }
    )
    ;
}

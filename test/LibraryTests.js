'use strict';
const assert = require("assert");
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

const fs = require('fs');

const getBaseConfig = require('../actions/getEnvVariables').getBaseConfigObject;
const versionValidator = require('../actions/versionValidator');
const libraryHelper = require("../actions/helpers/libraryHelper");

const loadTaskTemplate = require("../actions/filehandling/loadTaskTemplate");

const constants = require('./TestConstants');

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
            describe("libraryHelper", () => {
                let proxy;
                before(async () => {
                    proxy = await constants.getEnvProxy();
                });

                after(() => {
                    if (proxy) {
                        log.debug("closing proxy.");
                        proxy.close();
                        proxy = undefined;
                    }
                });

                it("loads service version from env", async () => {
                    const versions = await libraryHelper.loadServiceVersionsFromEnv(proxy);
                    assert.equal( versions instanceof Object, true);
                    assert.equal(Object.keys(versions).length > 0, true);
                    assert.equal(!!versions['email'], true);
                })
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
                const taskTemplateContent = {
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
                    const config = getBaseConfig({
                        TARGET_ENV: "delPocko"
                    });
                    const expected = {
                        dummy: "4.4.4"
                    };
                    const taskTemplate = loadTaskTemplate(config, taskTemplateContent)

                    assert.deepEqual(libraryHelper.fetchServiceVersionDependencies(config, taskTemplate), expected)
                });

                it("fetches with env-settings", () => {
                    const config = getBaseConfig({
                        TARGET_ENV: "develop"
                    });
                    const expected = {
                        dummy: "2.2.2"
                    };
                    const taskTemplate = loadTaskTemplate(config, taskTemplateContent);

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
                        log.debug(versionValidator.renderVersionValidationResult(renderingBase));

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
                let proxy;
                before(async () => {
                    proxy = await constants.getEnvProxy();
                });

                after(() => {
                    if (proxy) {
                        log.debug("closing proxy.");
                        proxy.close();
                        proxy = undefined;
                    }
                });

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
                    const result = await libraryHelper.checkLibraryDependencies(getBaseConfig({}), proxy, serviceDependencies, packageJson);
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
                        log.debug(await versionValidator.renderVersionValidationResult(checkResult))
                    })
                });
            });
        }
    )
    ;
}

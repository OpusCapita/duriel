const fileHandler = require('../actions/filehandling/fileHandler');
const loadConfigFile = require('../actions/filehandling/loadConfigFile');

const dummyConfigPath = `./dummyConfig-${new Date().getTime()}.json`;
const constants = require("./TestConstants");
let config = {};

before();
require("./FileHandlingsTests").run(config);
require("./VariableInjectionTests").run(config, constants);
require("./BaseFunctionTests").run();
require("./CommandBuilderTests").run();
after();

function before() {
    fileHandler.saveObject2File(constants.testConfigFields, dummyConfigPath, true);
    config = loadConfigFile(dummyConfigPath);
}

function after() {
    require("fs").unlinkSync(dummyConfigPath);
}

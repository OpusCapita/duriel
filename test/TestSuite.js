const saveObject2File = require('../actions/saveObject2File');
const loadConfigFile = require('../actions/loadConfigFile');

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
    saveObject2File(constants.testConfigFields, dummyConfigPath, true);
    config = loadConfigFile(dummyConfigPath);
}

function after() {
    require("fs").unlinkSync(dummyConfigPath);
}

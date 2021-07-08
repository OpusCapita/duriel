const fileHandler = require('../actions/filehandling/fileHandler');
const loadConfigFile = require('../actions/filehandling/loadConfigFile');

const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const assert = require('assert');

process.env.andariel_loglevel = "warn";

async function fun() {
    describe("Test duriel!", async () => {
        //await require('./IntegrationTests').run();
        await require("./BaseFunctionTests").run();
        //await require("./MonitoringTests").run();
        await require("./VersionTests").run();
        //await require("./LibraryTests").run();
        //await require("./CommandBuilderTests").run();
        //await require("./FileHandlingsTests").run();
        //await require("./EnvProxyTests").run();
        await require("./VariableInjectionTests").run();
        //await require('./ConsulFunctionTests').run();
    })
}


fun();

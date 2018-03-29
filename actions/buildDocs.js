'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const fileHandler = require('./filehandling/fileHandler');

module.exports = async function (config, commit = false) {
    const proxy = new EnvProxy();
    let packageJson;
    try {
        packageJson = await fileHandler.loadFile2Object("./package.json");
    } catch (error) {
        log.error("could not load package.json");
        return;
    }

    if (packageJson['scripts'] && packageJson['scripts']['doc']) {
        await proxy.executeCommand_L("rm -Rf wiki");
        await proxy.executeCommand_L(`git clone https://github.com/OpusCapita/${config['serviceName']}.wiki.git wiki`);
        await proxy.executeCommand_L(`docker-compose run main npm run doc`);
        if (commit) {
            await proxy.changeCommandDir_L("wiki");
            await proxy.executeCommand_L("git add --all . ; git commit -am 'Updated documentation. [ci skip]' ; git push ;");
            await proxy.changeCommandDir_L("..");
        } else {
            await proxy.changeCommandDir_L("wiki");
            const gitStatus = await proxy.executeCommand_L("git status");
            log.info("git would commit doc changes:", gitStatus);
            await proxy.changeCommandDir_L("..");
        }
    }

};
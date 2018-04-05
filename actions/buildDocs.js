'use strict';
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();
const EnvProxy = require('../EnvProxy');
const fileHandler = require('./filehandling/fileHandler');
const gitHelper = require('./helpers/gitHelper');

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
        await proxy.changeCommandDir_L("wiki");
        if (commit) {
            await gitHelper.addAll();
            await gitHelper.commit('updated documentation. [ci skip]');
            await gitHelper.push();
        } else {
            const gitStatus = await gitHelper.status();
            log.info("git would commit doc changes:", gitStatus);
        }
        await proxy.changeCommandDir_L("..");

    }

};
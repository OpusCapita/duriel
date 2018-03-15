const fs = require('fs');
const EpicLogger = require('../EpicLogger');
const log = new EpicLogger();

module.exports = function (config) {
    // setting version
    let versionFileContent;
    if (!fs.existsSync("./VERSION")) {
        log.error('no VERSION-File found! exiting!');
        throw new Error('no VERSION-File found! exiting!');
    } else {
        versionFileContent = fs.readFileSync("./VERSION", "utf8");
        versionFileContent = versionFileContent.replace(/(\r\n|\n|\r)/gm, "");
    }
    return `${versionFileContent}-${config.get('CIRCLE_BRANCH') === 'master' ? 'rc' : 'dev'}-${config.get('CIRCLE_BUILD_NUM')}`;
};
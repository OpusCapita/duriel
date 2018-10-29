/**
 * Module that offers functions to interact with git.
 * @module
 */

'use strict';
const EnvProxy = require("../../EnvProxy");
const EpicLogger = require('../../EpicLogger');
const log = new EpicLogger();

//const versionHelpr = require('./versionHelper');

module.exports = {
    addFiles,
    addAll,
    tag,
    checkout,
    commit,
    push,
    pushTags,
    status,
    setCredentials,
    checkForChanges,
    getTags,
    getMainVersionTags,
    getMerges,
    getStatus
};


async function addFiles(files) {
    log.info(`git: add '${files}'`);
    if (!Array.isArray(files)) {
        files = [files]
    }
    for (let file of files) {
        await executeCommand(`git add ${file}`);
    }
}

async function addAll() {
    log.info("git: adding all files.");
    return await executeCommand(`git add --all .`)
}

async function commit(commitMessage) {
    log.info("git: committing!");
    return await executeCommand(`git commit -m '${commitMessage}'`);
}

async function tag(tag, push) {
    log.info(`git: adding tag '${tag}'`);
    await executeCommand(`git tag -a '${tag}' -m '${tag}'`);
    if (push) {
        return pushTags();
    }
}

async function push(branch) {
    log.info('git: push');
    return await executeCommand(`git push origin ${branch}`);
}

async function pushTags() {
    log.info('git: pushing tags!');
    return await executeCommand("git push --tags")
}

async function status() {
    log.info('git: status');
    return await executeCommand("git status");
}

async function executeCommand(command) {
    const proxy = new EnvProxy();
    return await proxy.executeCommand_L(command);
}

async function checkForChanges() {
    try {
        let changedFiles = await executeCommand("git ls-files -m");
        log.debug("files that changed in git-repository", changedFiles);
        return changedFiles.replace(/(\r\n\t|\n|\r\t)/gm, "").replace(" ", "");
    } catch (err) {
        log.error("error", err);
    }
}

async function checkout(branch) {
    try {
        log.info(`git: checkout ${branch}`);
        return await executeCommand(`git checkout ${branch}`);
    } catch (e) {
        log.error(`checkout of branch '${branch}' failed`)
    }
}

async function setCredentials(user, mail) {
    log.info(`setting git-credentials: user: ${user}, email: ${mail}`);
    await executeCommand(`git config --global user.name ${user}`);
    await executeCommand(`git config --global user.email ${mail}`);
}

/**
 * Getter
 */

async function getTags(filter) {
    let command = "git tag --list";
    if (filter) {
        if (filter.commit)
            command = `${command} --points-at ${filter.commit}`;
        else if (filter.merged) {
            command = `${command} --merged ${filter.merged}`
        }
    }
    return await executeCommand(command)
        .then(tags => tags.split('\n')
            .filter(tag => {
                if (!tag)
                    return false;
                if (filter && filter.pattern && !new RegExp(filter.pattern, "gm").test(tag))
                    return false;

                return true
            })
        )
}

async function getMainVersionTags() {
    return await getTags({pattern: /(^[0-9]+\.)([0-9]+\.)([0-9]+)$/})
        .then(tags => tags.sort(compareVersion).reverse())
        .then(tags => {
            if (!tags.length)
                return ['0.0.0'];
            else
                log.info(compareVersion("1.2.0","1.10.0"));
                log.info("Tags sorted:");
                log.info(JSON.stringify(tags));
                console.log(JSON.stringify(tags));
                return tags;
        })
}

/**
 *
 * @param filter {object} - e.g. { commit: '', author: '', message: '' }
 * @returns {Array<object>} @example [ { commit: '', parents: [ '', '' ], author: 'kpm', date: 2017-11-20T15:55:00.000Z, message: '' } ]
 */
async function getMerges(filter) {
    function createUsedFilter(filter) {
        const result = {};
        if (filter) {
            if (filter.commit)
                result.commit = filter.commit.trim();
            if (filter.message)
                result.message = filter.message.trim();
        }
        return result;
    }

    return await executeCommand(`git log --merges --all --pretty="%H% ;##; %P% ;##; %an% ;##; %ae% ;##; %ad% ;##; %s% ;##; %e% ;##; %T"`)
        .then(data => {
            return data.split("\n")
                .map(row => {
                    const cols = row.split(";##;").filter(it => it);
                    if (cols.length === 8) {
                        return {
                            commit: cols[0].trim(),
                            parents: cols[1].split(" ").filter(it => it).map(it => it.trim()),
                            author: {
                                name: cols[2].trim(),
                                mail: cols[3].trim()
                            },
                            date: new Date(cols[4]),
                            message: cols[5].trim(),
                            encoding: cols[6].trim(),
                            tree: cols[7].trim()
                        }
                    }
                }).filter(it => {
                    if (!it)
                        return it;
                    if (filter) {
                        const usedFilter = createUsedFilter(filter);
                        for (const filterino in usedFilter) {
                            if (usedFilter[filterino] && usedFilter[filterino] !== it[filterino]) {
                                return false;
                            }
                        }
                        return true;
                    }
                    return true;
                });
        })
}

/**
 * Function that executes git status --porcelain.
 * result is parsed and can be filtered by the param.
 * @param filter - array of all git status that should be returned:
 *      - M: modified
 *      - MM: modified (changed a added file-state)
 *      - ??: new
 *      - D: deleted
 * @returns Array with all files that were gathered
 *      @example e.g. {status: "M", file: "del.pocko"}
 */
async function getStatus(filter) {
    const status = await executeCommand('git status --porcelain');
    return status.split('\n')
        .map(row => row.split(/[ ]+/).filter(col => col)) // splitting into cols
        .filter(it => it.length)    // removing empty rows
        .map(it => ({status: it[0], file: it[1]})) // parsing into objects
        .filter(it => !filter || filter.includes(it.status)) // filtering
}

/**
 * compares the two version-strings
 * @param a: (e.g. '1.0.0')
 * @param b: (e.g. '1.0.0')
 * @returns  number
 */
function compareVersion(a, b) {
    log.info("Compare started!");
    if (!a && !b)
        return 0;
    if (!a)
        return -5;
    if (!b)
        return 5;

    const aSplit = a.split(".");
    const bSplit = b.split(".");
    console.log(a+' <> '+b);
    console.log(parseInt(aSplit[0]) - parseInt(bSplit[0]));
    console.log(parseInt(aSplit[1]) - parseInt(bSplit[1]));
    console.log(parseInt(aSplit[2]) - parseInt(bSplit[2]));
    if (parseInt(aSplit[0]) !== parseInt(bSplit[0])) {
        return parseInt(aSplit[0]) - parseInt(bSplit[0]);
    } else if (parseInt(aSplit[1]) !== parseInt(bSplit[1])) {
        return parseInt(aSplit[1]) - parseInt(bSplit[1]);
    } else {
        return parseInt(aSplit[2]) - parseInt(bSplit[2]);
    }
}
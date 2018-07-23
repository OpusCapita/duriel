# duriel deployment process

## branch behaviour

| Branch    | TargetEnv |
|-----------|-----------|
| feature/* | -         |
| develop   | develop   |
| release/* | stage     |
| hotfix    | -         |
| master    | prod      |

## behaviour flags

| Branch    | TargetEnv |
|-----------|-----------|
| e2e_skip  | ignore the result of the e2e-tests |
| andariel_loglevel  | loglevel of outputs (severe, debug, info, warn, error) |


## known issues
- some nodes block secreet-reading and the deployment thinks, it need to create a new secret.


# libVersionFetcher

## functions
Fetches the version of web-init and event-client from every container inside an env.
Exports the data of a env into a csv-file and packages multiple files.

## usage
node libVersionFetcher < ssh-user > < env > [< env >]

## requirements
- agent forwarding
- node on the executing environment (e.g. the devbox)

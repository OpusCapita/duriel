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
| pull_request_creation_skip | buildprocess will not create pull-requests |


## known issues
- some nodes block secreet-reading and the deployment thinks, it need to create a new secret.

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

| Flag    | TargetEnv |
|-----------|-----------|
| e2e_skip  | ignore the result of the e2e-tests |
| andariel_loglevel  | loglevel of outputs (severe, debug, info, warn, error) |
| pull_request_creation_skip | buildprocess will not create pull-requests |


## pull-request creation

When deploying successfully to a "hotfix/" or "release/" branch, the build-process will create pull-requests in GitHub.

| Branch    | PR's to |
|-----------|-----------|
| release/* | master |
| hotfix    | master, develop |

## known issues
- some nodes block secreet-reading and the deployment thinks, it need to create a new secret.

## overview

![alt text](https://raw.githubusercontent.com/OpusCapita/duriel/feature/hotfix-impl/images/nbp_v2.png)

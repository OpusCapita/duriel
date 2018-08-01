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
| skip_doc_building | skip the documentation building |
| major_release | the deployment will create a new major-version. e.g. 0.8.15 => 1.0.0 |


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

# libVersionFetcher
## function
Fetches the version of specific libraries from every container inside an env.
Exports the data of an env into a csv-file and packages multiple files.

## usage
node libVersionFetcher < ssh-user > < env > [ < env > ]

## requirements
- agent forwarding
- node on the executing environment

## configuration
the config file inside directory contains the libraries that will be fetched and a flag to enable packaging of the csv-files

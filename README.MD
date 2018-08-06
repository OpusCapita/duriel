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

## task_template.json

The task_template.json is used to set up and configure a service in andariel.
It can contain on the one hand service-specific configurations (like consul-values or env-variables) or settings regarding the docker-swarm (e.g. cpu-limit, ports)

The configuration can be split into environment specific config. To do this create an entry inside this JSON called "develop", "stage" or "prod"
The data inside this entry will override the "default"

example:
```javascript
{
  "default": {
    "name": "${serviceName}",
    "log-driver": "gelf",
    "log-opt": [
      "gelf-address=udp://${logstash_ip}:12201",
      "tag=\"${serviceName}\""
    ],
    "constraint": [
      "engine.labels.nodetype==worker"
    ],
    "publish": [
      "mode=host,target=3019,published=3019,protocol=tcp"
    ],
    "host": [
      "consul:172.17.0.1"
    ],
    "env": [
      "SERVICE_NAME=${serviceName}",
      "SERVICE_3019_CHECK_HTTP=/api/health/check",
      "SERVICE_3019_CHECK_INTERVAL=15s",
      "SERVICE_3019_CHECK_TIMEOUT=3s",
      "NODE_ENV=production",
      "TICKET_ENV=develop"
    ],
    "oc-db-init": {
      "populate-test-data": "true"
    },
    "oc-consul-injection": {
      "redis/password": "${SECRET_:env_REDIS}",
    },
    "limit-cpu": "0.2",
    "limit-memory": "300M",
    "reserve-cpu": "0.01",
    "reserve-memory": "50M"
  },
  "develop": {
    "limit-cpu": "0.3",
    "oc-consul-injection": {
        "special_dev_var": "secret"
  }
}

```


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

# local docCreation
## usage
download the git-repositories in parallel folders:
e.g.
```
/--/andariel-monitoring
/--/duriel
```
execute following command in the console:
```bash
node -e "require('../duriel/actions/buildDocs.js').createAllDocFiles()"
```

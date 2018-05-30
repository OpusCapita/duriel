# duriel deployment process

## logging

### available loglevel:
- severe
- debug
- info
- warn
- error

### configuration of loglevel:
 add env-variable "andariel-loglevel" to CircleCi.

## e2e

### skipping e2e
**DON'T USE THIS!**

 skip failure of deployment on failing e2e-test by:
 add env-variable "e2e_skip" to CircleCi.

## branch behaviour

- develop/nbp => deployment on "develop"
- master => deployment on "stage", then deployment on "prod"

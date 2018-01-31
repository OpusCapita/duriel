#!/usr/bin/env bash
export GIT_USER=StefanTurbine
export GIT_EMAIL=Stefan.Tubben@OpusCapita.com
export GIT_TOKEN=4c6a5aa6a416b72231ebc9554dc7ed9876c0af01
export DOCKER_USER=stuebben
export DOCKER_PASS=st3fan123!

export CIRCLE_PROJECT_REPONAME=servicenow-integration
export andariel_branch=develop
export CIRCLE_BRANCH=develop
export CIRCLE_BUILD_NUM="7-newbuilder"
export CIRCLE_SHA1=f3cfa8a940973551d02b9a557626a61cc81f5b2f

node ../duriel/buildscript.js opuscapita/servicenow-integration


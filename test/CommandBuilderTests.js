'use strict';
const assert = require("assert");
const dockerCommandBuilder = require('../actions/dockerCommandBuilder');


const taskTemplatePath = "./task_template_mapped.json";
const fieldDefsPath = "./field_defs.json";
const serviceConfigPath = "./service_config.json";

module.exports.run = run;
function run() {
    describe("Docker Command Building", () => {
        prepareTaskTemplate();
        prepareFieldDefs();
        it("create mode", () => {
            // TODO:
        });
        it("update mode", () => {
            // TODO:
        });
        cleanup();
    })
}

function prepareTaskTemplate() {

}


function prepareFieldDefs() {

}

function cleanup() {

}
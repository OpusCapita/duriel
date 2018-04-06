module.exports = {
    testConfigFields: {
        value1: "injectedValue1",
        value2: "injectedValue2",
        TARGET_ENV: "develop",
        value_develop_1: "injectedValue2",
        value_stage_1: "injected4stage"
},
    checkedField: "value1",
    simple: {
        leave: "left",
        inject: "${value2}"
    },
    simpleMissingVar: {
        leave: "left",
        inject: "${missingValue}"
    }, simpleCompareField: "leave",
    successResult: {
        leave: "left",
        inject: "injectedValue2"
    },
    withEnvInjection: {
        leave: "left",
        inject: "${value_:env_1}"
    }
};

const dummyTaskTemplate = {

}
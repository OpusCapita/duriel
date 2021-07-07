const EnvProxy = require('../EnvProxy');
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
    },
    getEnvProxy: async () => {
        const proxyConfig = require('../envInfo').develop;
        if (process.env.admin_user) {proxyConfig.admin_user = process.env.admin_user;}
        return await new EnvProxy().init(proxyConfig).
            catch(e => console.error(e))
    },
    task_template: {
        default: {
            "oc-secret-injection": {
                alpha: "i am a string",
                beta: { value: "i am not encoded" },
                gamma: { encoding: "base64", value: "aSBhbSBlbmNvZGVk" },
                mysecret: "i am a secret secret that is secretly not secret!"
            },
            "serviceDependencies": {
                "servicenow-integration": "0.0.0",
                "email": "0.0.0"
            },
            "replicas": 2
        }
    }
};

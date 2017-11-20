var EnvProxy = require('./EnvProxy.js');
var destEnvProxy;
var srcEnvProxy = new EnvProxy().init({})
  .then( () => {
    console.log("srcEnvProxy created");
  })
  .then( () => {
    return destEnvProxy = new EnvProxy().init({})
  })
  .then(() => {
    console.log("yeah baby");
  });

console.log("srcEnvProxy = " + srcEnvProxy);


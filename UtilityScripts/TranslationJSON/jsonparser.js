const fs = require('fs');

if (!fs.existsSync('./package.json')) {
    throw new Error("could not find package.json");
}
const packageJson = fs.readFileSync('./package.json', {encoding: 'utf8'});


const parsedPackageJson = JSON.parse(packageJson);
console.log('axios' in parsedPackageJson.dependencies)
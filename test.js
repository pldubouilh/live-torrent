const argv = require('yargs').argv

const flag = typeof argv.s === 'undefined' ? true : (argv.s === 'true')
console.log(flag)

let Client = require('ssh2').Client;

let conn = new Client();
conn.on('ready', function() {
    console.log('Client :: ready');
    conn.shell(function(err, stream) {
        if (err) throw err;
        stream.on('close', function() {
            console.log('Stream :: close');
            conn.end();
        }).on('data', function(data) {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', function(data) {
            console.log('STDERR: ' + data);
        });
        stream.end('ls -l\nexit\n');
    });
}).connect({
    host: '127.0.0.1',
    port: 8500,
    username: 'consul',
    //privateKey: require('fs').readFileSync('/here/is/my/key')
});


const init = function(){

};
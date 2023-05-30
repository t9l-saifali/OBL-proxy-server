const cluster = require('cluster');
// const env = require('../HOST.env.json');

if (cluster.isMaster) {
    console.log('SERVER initiated as MARK42 on: %d\n', process.pid);
    // const cpuCount = require('os').cpus().length;
    const cpuCount = 1;

    for (let i = 0; i < cpuCount; i += 1)
        cluster.fork();
} else {
    require('./server')(cluster.worker.id)
    // if(typeof env['SKIP_SERVE'] === 'undefined' || (typeof env['SKIP_SERVE'] === 'undefined' && !env['SKIP_SERVE'])){
    //     require('./serve')(cluster.worker.id)
    // }
}
cluster.on('exit', function (worker) {
    console.log('SERVER %d died', worker.id);
    // Respawn it
    cluster.fork();
});

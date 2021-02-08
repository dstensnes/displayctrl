// vim: sts=4 ts=4 sw=4 autoindent expandtab

const express = require('express');
const ws = require('ws');
const DB10D = require('./lib/devices/SamsungDB10D.js');

const app = express();
app.set('etag', false);
app.set('x-powered-by', false);
app.set('debug', true);

const wsServer = new ws.Server({ noServer: true });
wsServer.on('connection', socket => {
    socket.on('message', message => console.log(message));
});

const server = app.listen(3000);
server.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
        wsServer.emit('connection', socket, request);
    });
});



app.use(express.static('public'));

// Temporary test device
const screen = new DB10D({ "ip": "10.0.0.44", "displayId": 0 });


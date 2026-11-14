const http = require('http');
const express = require('express');
const { ExpressPeerServer } = require('peer');
const app = express();
const server = http.createServer(app);
app.use('/', ExpressPeerServer(server, { path: '/', allow_discovery: false }));
const port = Number(process.env.PEER_PORT || 9000);
server.listen(port, '127.0.0.1', () => console.log('peer server on 127.0.0.1:' + port));

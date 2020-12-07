//IMPORTS
const express = require('express');
const app = express();
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const http = require('http');
const https = require('https');

let serverOptions = {
    hostName: 'localhost',
    listenPort: 5005,
    useHttps: true,
    httpsKeyFile: './cert/key.pem',
    httpsCertFile: './cert/cert.pem',
};

let sslOptions = {};
if (serverOptions.useHttps) {
    sslOptions.key = fs.readFileSync(serverOptions.httpsKeyFile).toString();
    sslOptions.cert = fs.readFileSync(serverOptions.httpsCertFile).toString();
}

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/static', express.static(__dirname + '/static'));

const webPort = serverOptions.listenPort;

// ROUTES
app.get('/', (req, res) => {
    res.send('webrtc server running');
});

// START SERVER
let webServer = null;
if (serverOptions.useHttps) {
    // -- https ---
    webServer = https
        .createServer(sslOptions, app)
        .listen(webPort, function () {
            console.log(
                'Web server start. https://' +
                    serverOptions.hostName +
                    ':' +
                    webServer.address().port +
                    '/'
            );
        });
} else {
    // --- http ---
    webServer = http.Server(app).listen(webPort, function () {
        console.log(
            'Web server start. http://' +
                serverOptions.hostName +
                ':' +
                webServer.address().port +
                '/'
        );
    });
}

//SOCKET CONNECT
const socketMain = require('./socket/index');

const io = socketIo(webServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

socketMain(io);

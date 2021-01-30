const express = require('express');
const path = require('path');
//const compression = require('compression');
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

//app.use(compression());

let setCache = function (req, res, next) {
  // here you can define period in second, this one is 5 minutes
  const period = 60 * 5;

  // you only want to cache for GET requests
  if (req.method == 'GET') {
    res.set('Cache-control', `public, max-age=${period}`);
  } else {
    // for the other requests set strict no caching parameters
    res.set('Cache-control', `no-store`);
  }

  // remember to call next() to pass on the request
  next();
};

// now call the new middleware function in your app

const webPort = serverOptions.listenPort;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(setCache);

app.use(express.static(path.resolve(__dirname, './build')));
app.use((req, res) => res.sendFile(`${__dirname}/build/index.html`));

// START SERVER
let webServer = null;
if (serverOptions.useHttps) {
  // -- https ---
  webServer = https.createServer(sslOptions, app).listen(webPort, function () {
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

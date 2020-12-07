const mediasoupServer = require('./mediasoup-server');

function socketMain(io) {
    io.on('connection', (socket) => {
        console.log('New user online');

        socket.on('disconnect', () => {
            console.log('User offline');
        });
    });
    mediasoupServer(io);
}
module.exports = socketMain;

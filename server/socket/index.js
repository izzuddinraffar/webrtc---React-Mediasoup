const broadcast = require('./video-broadcast');

function socketMain(io) {
    io.on('connection', (socket) => {
        console.log('New user online');

        socket.on('disconnect', () => {
            console.log('User offline');
        });
    });
    broadcast(io);
}
module.exports = socketMain;

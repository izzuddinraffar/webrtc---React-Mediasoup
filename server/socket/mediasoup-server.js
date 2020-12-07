const broadcast = require('./video-broadcast');
const conference = require('./video-conference');

function socketMain(io) {
    broadcast(io);
    conference(io);
}
module.exports = socketMain;

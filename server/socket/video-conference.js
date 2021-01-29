function consoleLog(data) {
  //console.log(data);
}

function socketMain(io) {
  const conferenceIO = io.of('/video-conference');
  const MODE_STREAM = 'stream';
  const MODE_SHARE_SCREEN = 'share_screen';

  conferenceIO.on('connection', (socket) => {
    consoleLog('conference');

    socket.on('disconnect', function () {
      //   close user connection
      const roomName = getRoomname();
      consoleLog(
        'client disconnected. socket id=' +
          getId(socket) +
          '  , total clients=' +
          getClientCount()
      );
      cleanUpPeer(roomName, socket);

      // --- socket.io room ---
      socket.leave(roomName);
    });

    socket.on('getRouterRtpCapabilities', (data, callback) => {
      const router = defaultRoom.router;
      if (router) {
        consoleLog('getRouterRtpCapabilities: ', router.rtpCapabilities);
        sendResponse(router.rtpCapabilities, callback);
      } else {
        sendReject({ text: 'ERROR- router NOT READY' }, callback);
      }
    });

    // --- setup room ---
    socket.on('prepare_room', async (data) => {
      const roomId = data.roomId;
      const existRoom = Room.getRoom(roomId);
      if (existRoom) {
        console.log('--- use exist room. roomId=' + roomId);
      } else {
        console.log('--- create new room. roomId=' + roomId);
        const room = await setupRoom(roomId);
      }

      // --- socket.io room ---
      socket.join(roomId);
      setRoomname(roomId);
    });

    // --- producer ----
    socket.on('createProducerTransport', async (data, callback) => {
      const mode = data.mode;

      const roomName = getRoomname();

      console.log('-- createProducerTransport ---room=%s', roomName);
      const { transport, params } = await createTransport(roomName);
      addProducerTrasport(roomName, getId(socket), transport);
      transport.observer.on('close', () => {
        const id = getId(socket);
        const videoProducer = getProducer(roomName, id, 'video', mode);
        if (videoProducer) {
          videoProducer.close();
          removeProducer(roomName, id, 'video', mode);
        }
        const audioProducer = getProducer(roomName, id, 'audio', mode);
        if (audioProducer) {
          audioProducer.close();
          removeProducer(roomName, id, 'audio', mode);
        }
        removeProducerTransport(roomName, id);
      });
      //consoleLog('-- createProducerTransport params:', params);
      sendResponse(params, callback);
    });

    socket.on('connectProducerTransport', async (data, callback) => {
      const roomName = getRoomname();
      const transport = getProducerTrasnport(roomName, getId(socket));
      await transport.connect({ dtlsParameters: data.dtlsParameters });
      sendResponse({}, callback);
    });

    socket.on('produce', async (data, callback) => {
      const roomName = getRoomname();
      const { kind, rtpParameters, mode } = data;
      consoleLog('-- produce --- kind=' + kind);

      const id = getId(socket);
      const transport = getProducerTrasnport(roomName, id);
      if (!transport) {
        console.error('transport NOT EXIST for id=' + id);
        return;
      }
      const producer = await transport.produce({ kind, rtpParameters });
      addProducer(roomName, id, producer, kind, mode);
      producer.observer.on('close', () => {
        consoleLog('producer closed --- kind=' + kind);
      });
      sendResponse({ id: producer.id }, callback);

      // inform clients about new producer
      if (roomName) {
        console.log('--broadcast room=%s newProducer ---', roomName);
        socket.broadcast.to(roomName).emit('newProducer', {
          socketId: id,
          producerId: producer.id,
          kind: producer.kind,
          mode: mode,
        });
      } else {
        console.log('--broadcast newProducer ---');
        socket.broadcast.emit('newProducer', {
          socketId: id,
          producerId: producer.id,
          kind: producer.kind,
          mode: mode,
        });
      }
    });

    // --- consumer ----
    socket.on('createConsumerTransport', async (data, callback) => {
      const roomName = getRoomname();
      consoleLog('-- createConsumerTransport -- id=' + getId(socket));
      const { transport, params } = await createTransport(roomName);
      addConsumerTrasport(roomName, getId(socket), transport);
      transport.observer.on('close', () => {
        const localId = getId(socket);
        removeConsumerSetDeep(roomName, localId, MODE_STREAM);
        removeConsumerSetDeep(roomName, localId, MODE_SHARE_SCREEN);
        /*
              let consumer = getConsumer(getId(socket));
              if (consumer) {
                consumer.close();
                removeConsumer(id);
              }
              */
        removeConsumerTransport(roomName, localId);
      });
      //consoleLog('-- createTransport params:', params);
      sendResponse(params, callback);
    });

    socket.on('connectConsumerTransport', async (data, callback) => {
      const roomName = getRoomname();
      consoleLog('-- connectConsumerTransport -- id=' + getId(socket));
      let transport = getConsumerTrasnport(roomName, getId(socket));
      if (!transport) {
        console.error('transport NOT EXIST for id=' + getId(socket));
        return;
      }
      await transport.connect({ dtlsParameters: data.dtlsParameters });
      sendResponse({}, callback);
    });

    socket.on('consume', async (data, callback) => {
      console.error('-- ERROR: consume NOT SUPPORTED ---');
      return;
    });

    socket.on('resume', async (data, callback) => {
      console.error('-- ERROR: resume NOT SUPPORTED ---');
      return;
    });

    socket.on('getCurrentProducers', async (data, callback) => {
      const roomName = getRoomname();
      const clientId = data.localId;
      consoleLog('-- getCurrentProducers for Id=' + clientId);

      const remoteVideoIds = getRemoteIds(roomName, clientId, 'video');
      consoleLog('-- remoteVideoIds:', remoteVideoIds);
      const remoteAudioIds = getRemoteIds(roomName, clientId, 'audio');
      consoleLog('-- remoteAudioIds:', remoteAudioIds);

      sendResponse(
        {
          remoteVideoIds: remoteVideoIds,
          remoteAudioIds: remoteAudioIds,
        },
        callback
      );
    });

    socket.on('consumeAdd', async (data, callback) => {
      const roomName = getRoomname();
      const localId = getId(socket);
      const kind = data.kind;
      const mode = data.mode;
      consoleLog('-- consumeAdd -- localId=%s kind=%s', localId, kind);

      let transport = getConsumerTrasnport(roomName, localId);
      if (!transport) {
        console.error('transport NOT EXIST for id=' + localId);
        return;
      }
      const rtpCapabilities = data.rtpCapabilities;
      const remoteId = data.remoteId;
      consoleLog(
        '-- consumeAdd - localId=' +
          localId +
          ' remoteId=' +
          remoteId +
          ' kind=' +
          kind
      );
      const producer = getProducer(roomName, remoteId, kind, mode);
      if (!producer) {
        console.error(
          'producer NOT EXIST for remoteId=%s kind=%s',
          remoteId,
          kind,
          mode
        );
        return;
      }

      const { consumer, params } = await createConsumer(
        roomName,
        transport,
        producer,
        rtpCapabilities
      ); // producer must exist before consume
      //subscribeConsumer = consumer;
      addConsumer(roomName, localId, remoteId, consumer, kind, mode); // TODO: MUST comination of  local/remote id
      consoleLog(
        'addConsumer localId=%s, remoteId=%s, kind=%s',
        localId,
        remoteId,
        kind
      );
      consumer.observer.on('close', () => {
        consoleLog('consumer closed ---');
      });
      consumer.on('producerclose', () => {
        consoleLog('consumer -- on.producerclose');
        consumer.close();
        removeConsumer(roomName, localId, remoteId, kind, mode);

        // -- notify to client ---
        socket.emit('producerClosed', {
          localId: localId,
          remoteId: remoteId,
          kind: kind,
          mode: mode,
        });
      });

      consoleLog('-- consumer ready ---');
      sendResponse(params, callback);
    });

    socket.on('resumeAdd', async (data, callback) => {
      const roomName = getRoomname();
      const localId = getId(socket);
      const remoteId = data.remoteId;
      const kind = data.kind;
      const mode = data.mode;
      consoleLog(
        '-- resumeAdd localId=%s remoteId=%s kind=%s',
        localId,
        remoteId,
        kind
      );
      let consumer = getConsumer(roomName, localId, remoteId, kind, mode);
      if (!consumer) {
        console.error('consumer NOT EXIST for remoteId=' + remoteId);
        return;
      }
      await consumer.resume();
      sendResponse({}, callback);
    });

    socket.on('producerStopShareScreen', async (data, callback) => {
      const roomName = getRoomname();
      const id = getId(socket);

      removeConsumerSetDeep(roomName, id, MODE_SHARE_SCREEN);

      {
        const videoProducer = getProducer(
          roomName,
          id,
          'video',
          MODE_SHARE_SCREEN
        );
        if (videoProducer) {
          videoProducer.close();
          removeProducer(roomName, id, 'video', MODE_SHARE_SCREEN);
        }
      }

      {
        const audioProducer = getProducer(
          roomName,
          id,
          'audio',
          MODE_SHARE_SCREEN
        );
        if (audioProducer) {
          audioProducer.close();
          removeProducer(roomName, id, 'audio', MODE_SHARE_SCREEN);
        }
      }

      // socket.broadcast.emit('shareScreenClosed', {
      //     callerID: id,
      // });
    });

    // ---- sendback welcome message with on connected ---
    const newId = getId(socket);
    sendback(socket, { type: 'welcome', id: newId });

    // --- send response to client ---
    function sendResponse(response, callback) {
      //consoleLog('sendResponse() callback:', callback);
      callback(null, response);
    }

    // --- send error to client ---
    function sendReject(error, callback) {
      callback(error.toString(), null);
    }

    function sendback(socket, message) {
      socket.emit('message', message);
    }

    function setRoomname(room) {
      socket.roomname = room;
    }

    function getRoomname() {
      const room = socket.roomname;
      return room;
    }
  });

  function getId(socket) {
    return socket.id;
  }

  const getClientCount = async () => {
    // WARN: undocumented method to get clients number

    var nspSockets = await conferenceIO.allSockets();
    consoleLog('nspSockets');
    consoleLog(nspSockets);
  };

  async function setupRoom(name) {
    const room = new Room(name);
    const mediaCodecs = mediasoupOptions.router.mediaCodecs;
    const router = await worker.createRouter({ mediaCodecs });
    router.roomname = name;

    router.observer.on('close', () => {
      consoleLog('-- router closed. room=%s', name);
    });
    router.observer.on('newtransport', (transport) => {
      consoleLog('-- router newtransport. room=%s', name);
    });

    room.router = router;
    Room.addRoom(room, name);
    return room;
  }

  function cleanUpPeer(roomname, socket) {
    const id = getId(socket);
    removeConsumerSetDeep(roomname, id, MODE_STREAM);
    removeConsumerSetDeep(roomname, id, MODE_SHARE_SCREEN);
    /*
           const consumer = getConsumer(id);
           if (consumer) {
             consumer.close();
             removeConsumer(id);
           }
           */

    const transport = getConsumerTrasnport(roomname, id);
    if (transport) {
      transport.close();
      removeConsumerTransport(roomname, id);
    }

    {
      const videoProducer = getProducer(roomname, id, 'video', MODE_STREAM);
      if (videoProducer) {
        videoProducer.close();
        removeProducer(roomname, id, 'video', MODE_STREAM);
      }
    }
    {
      const videoProducer = getProducer(
        roomname,
        id,
        'video',
        MODE_SHARE_SCREEN
      );
      if (videoProducer) {
        videoProducer.close();
        removeProducer(roomname, id, 'video', MODE_SHARE_SCREEN);
      }
    }
    {
      const audioProducer = getProducer(roomname, id, 'audio', MODE_STREAM);
      if (audioProducer) {
        audioProducer.close();
        removeProducer(roomname, id, 'audio', MODE_STREAM);
      }
    }
    {
      const audioProducer = getProducer(
        roomname,
        id,
        'audio',
        MODE_SHARE_SCREEN
      );
      if (audioProducer) {
        audioProducer.close();
        removeProducer(roomname, id, 'audio', MODE_SHARE_SCREEN);
      }
    }

    const producerTransport = getProducerTrasnport(roomname, id);
    if (producerTransport) {
      producerTransport.close();
      removeProducerTransport(roomname, id);
    }
  }

  // ========= room ===========

  class Room {
    constructor(name) {
      this.name = name;
      this.producerTransports = {};
      this.videoProducers = {};
      this.audioProducers = {};

      this.consumerTransports = {};
      this.videoConsumerSets = {};
      this.audioConsumerSets = {};

      this.router = null;
    }

    getProducerTrasnport(id) {
      return this.producerTransports[id];
    }

    addProducerTrasport(id, transport) {
      this.producerTransports[id] = transport;
      console.log(
        'room=%s producerTransports count=%d',
        this.name,
        Object.keys(this.producerTransports).length
      );
    }

    removeProducerTransport(id) {
      delete this.producerTransports[id];
      console.log(
        'room=%s producerTransports count=%d',
        this.name,
        Object.keys(this.producerTransports).length
      );
    }

    getProducer(id, kind, mode) {
      if (kind === 'video') {
        return this.videoProducers[id] && this.videoProducers[id][mode];
      } else if (kind === 'audio') {
        return this.audioProducers[id] && this.audioProducers[id][mode];
      } else {
        console.warn('UNKNOWN producer kind=' + kind);
      }
    }

    getRemoteIds(clientId, kind) {
      let remoteIds = [];
      if (kind === 'video') {
        for (const key in this.videoProducers) {
          if (key !== clientId) {
            remoteIds.push(key);
          }
        }
      } else if (kind === 'audio') {
        for (const key in this.audioProducers) {
          if (key !== clientId) {
            remoteIds.push(key);
          }
        }
      }
      return remoteIds;
    }

    addProducer(id, producer, kind, mode) {
      if (kind === 'video') {
        if (this.videoProducers[id] == undefined) {
          this.videoProducers[id] = {};
        }
        this.videoProducers[id][mode] = producer;
        consoleLog('addProducer');

        consoleLog(this.videoProducers);
        consoleLog(
          'videoProducers count=' + Object.keys(this.videoProducers).length
        );
      } else if (kind === 'audio') {
        if (this.audioProducers[id] == undefined) {
          this.audioProducers[id] = {};
        }
        this.audioProducers[id][mode] = producer;
        consoleLog(
          'audioProducers count=' + Object.keys(this.audioProducers).length
        );
      } else {
        console.warn('UNKNOWN producer kind=' + kind);
      }
    }

    removeProducer(id, kind, mode) {
      if (kind === 'video') {
        if (this.videoProducers[id] && this.videoProducers[id][mode]) {
          if (mode == MODE_STREAM) {
            delete this.videoProducers[id];
          } else {
            delete this.videoProducers[id][mode];
          }
        }
        console.log(this.videoProducers);
        console.log(
          'videoProducers count=' + Object.keys(this.videoProducers).length
        );
      } else if (kind === 'audio') {
        if (this.audioProducers[id] && this.audioProducers[id][mode]) {
          if (mode == MODE_STREAM) {
            delete this.audioProducers[id];
          } else {
            delete this.audioProducers[id][mode];
          }
        }
        console.log(this.audioProducers);
        console.log(
          'audioProducers count=' + Object.keys(this.audioProducers).length
        );

        // console.log(
        //     'audioProducers count=' + Object.keys(audioProducers).length
        // );
      } else {
        console.warn('UNKNOWN producer kind=' + kind);
      }
    }

    getConsumerTrasnport(id) {
      return this.consumerTransports[id];
    }

    addConsumerTrasport(id, transport) {
      this.consumerTransports[id] = transport;
      console.log(
        'room=%s add consumerTransports count=%d',
        this.name,
        Object.keys(this.consumerTransports).length
      );
    }

    removeConsumerTransport(id) {
      delete this.consumerTransports[id];
      console.log(
        'room=%s remove consumerTransports count=%d',
        this.name,
        Object.keys(this.consumerTransports).length
      );
    }

    getConsumerSet(localId, kind, mode) {
      if (kind === 'video') {
        return (
          this.videoConsumerSets[localId] &&
          this.videoConsumerSets[localId][mode]
        );
      } else if (kind === 'audio') {
        return (
          this.audioConsumerSets[localId] &&
          this.audioConsumerSets[localId][mode]
        );
      } else {
        console.warn('WARN: getConsumerSet() UNKNWON kind=%s', kind);
      }
    }

    addConsumerSet(localId, set, kind, mode) {
      if (kind === 'video') {
        if (this.videoConsumerSets[localId] == undefined) {
          this.videoConsumerSets[localId] = {};
        }
        this.videoConsumerSets[localId][mode] = set;
      } else if (kind === 'audio') {
        if (this.audioConsumerSets[localId] == undefined) {
          this.audioConsumerSets[localId] = {};
        }
        this.audioConsumerSets[localId][mode] = set;
      } else {
        console.warn('WARN: addConsumerSet() UNKNWON kind=%s', kind);
      }
    }

    removeConsumerSetDeep(localId, mode) {
      const videoSet = this.getConsumerSet(localId, 'video', mode);
      if (
        this.videoConsumerSets[localId] &&
        this.videoConsumerSets[localId][mode]
      ) {
        if (mode == MODE_STREAM) {
          delete this.videoConsumerSets[localId];
        } else {
          delete this.videoConsumerSets[localId][mode];
        }
      }

      if (videoSet) {
        for (const key in videoSet) {
          const consumer = videoSet[key];
          consumer?.close();
          delete videoSet[key];
        }

        consoleLog(
          'removeConsumerSetDeep video consumers count=' +
            Object.keys(videoSet).length
        );
      }

      const audioSet = this.getConsumerSet(localId, 'audio', mode);

      if (
        this.audioConsumerSets[localId] &&
        this.audioConsumerSets[localId][mode]
      ) {
        if (mode == MODE_STREAM) {
          delete this.audioConsumerSets[localId];
        } else {
          delete this.audioConsumerSets[localId][mode];
        }
      }
      if (audioSet) {
        for (const key in audioSet) {
          const consumer = audioSet[key];
          consumer?.close();
          delete audioSet[key];
        }

        consoleLog(
          'removeConsumerSetDeep audio consumers count=' +
            Object.keys(audioSet).length
        );
      }
    }

    getConsumer(localId, remoteId, kind, mode) {
      const set = this.getConsumerSet(localId, kind, mode);
      if (set) {
        return set[remoteId];
      } else {
        return null;
      }
    }

    addConsumer(localId, remoteId, consumer, kind, mode) {
      const set = this.getConsumerSet(localId, kind, mode);
      if (set) {
        set[remoteId] = consumer;
        consoleLog('consumers kind=%s count=%d', kind, Object.keys(set).length);
      } else {
        consoleLog('new set for kind=%s, localId=%s', kind, localId);
        const newSet = {};
        newSet[remoteId] = consumer;
        this.addConsumerSet(localId, newSet, kind, mode);
        consoleLog(
          'consumers kind=%s count=%d',
          kind,
          Object.keys(newSet).length
        );
      }
    }

    removeConsumer(localId, remoteId, kind, mode) {
      const set = this.getConsumerSet(localId, kind, mode);
      if (set) {
        if (mode == MODE_STREAM) {
          delete set[remoteId];
        } else {
          delete set[remoteId][mode];
        }

        consoleLog('consumers kind=%s count=%d', kind, Object.keys(set).length);
      } else {
        consoleLog('NO set for kind=%s, localId=%s', kind, localId);
      }
    }

    // --- static methtod ---
    static staticInit() {
      rooms = {};
    }

    static addRoom(room, name) {
      Room.rooms[name] = room;
      console.log('static addRoom. name=%s', room.name);
      //console.log('static addRoom. name=%s, rooms:%O', room.name, room);
    }

    static getRoom(name) {
      return Room.rooms[name];
    }

    static removeRoom(name) {
      delete Room.rooms[name];
    }
  }

  // -- static member --
  Room.rooms = {};

  // --- default room ---
  let defaultRoom = null;

  // ========= mediasoup ===========
  const mediasoup = require('mediasoup');
  const mediasoupOptions = {
    // Worker settings
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ],
    },
    // Router settings
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    },
    // WebRtcTransport settings
    webRtcTransport: {
      listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
    },
  };

  let worker = null;
  //let router = null;
  // let producerTransport = null;
  // let videoProducer = null;
  // let audioProducer = null;
  // let producerSocketId = null;
  //let consumerTransport = null;
  //let subscribeConsumer = null;

  async function startWorker() {
    const mediaCodecs = mediasoupOptions.router.mediaCodecs;
    worker = await mediasoup.createWorker();
    // router = await worker.createRouter({ mediaCodecs });
    //producerTransport = await router.createWebRtcTransport(mediasoupOptions.webRtcTransport);
    defaultRoom = await setupRoom('_default_room');
    console.log('-- mediasoup worker start. -- room:', defaultRoom.name);
  }

  startWorker();

  //
  // Room {
  //   id,
  //   transports[],
  //   consumers[],
  //   producers[],
  // }
  //

  // --- multi-producers --
  //   let producerTransports = {};
  //   let videoProducers = {};
  //   let audioProducers = {};

  function getProducerTrasnport(roomname, id) {
    if (roomname) {
      console.log('=== getProducerTrasnport use room=%s ===', roomname);
      const room = Room.getRoom(roomname);
      return room.getProducerTrasnport(id);
    } else {
      console.log(
        '=== getProducerTrasnport use defaultRoom room=%s ===',
        roomname
      );
      return defaultRoom.getProducerTrasnport(id);
    }
  }

  function addProducerTrasport(roomname, id, transport) {
    if (roomname) {
      const room = Room.getRoom(roomname);
      room.addProducerTrasport(id, transport);
      console.log('=== addProducerTrasport use room=%s ===', roomname);
    } else {
      defaultRoom.addProducerTrasport(id, transport);
      console.log(
        '=== addProducerTrasport use defaultRoom room=%s ===',
        roomname
      );
    }
  }

  function removeProducerTransport(roomname, id) {
    if (roomname) {
      const room = Room.getRoom(roomname);
      room.removeProducerTransport(id);
    } else {
      defaultRoom.removeProducerTransport(id);
    }
  }

  function getProducer(roomname, id, kind, mode) {
    if (mode == undefined) {
      return;
    }
    if (roomname) {
      const room = Room.getRoom(roomname);
      return room.getProducer(id, kind, mode);
    } else {
      return defaultRoom.getProducer(id, kind, mode);
    }
  }

  function getRemoteIds(roomname, clientId, kind) {
    if (roomname) {
      const room = Room.getRoom(roomname);
      return room.getRemoteIds(clientId, kind);
    } else {
      return defaultRoom.getRemoteIds(clientId, kind);
    }
  }

  function addProducer(roomname, id, producer, kind, mode) {
    if (mode == undefined) {
      return;
    }
    if (roomname) {
      const room = Room.getRoom(roomname);
      room.addProducer(id, producer, kind, mode);
      console.log('=== addProducer use room=%s ===', roomname);
    } else {
      defaultRoom.addProducer(id, producer, kind, mode);
      console.log('=== addProducer use defaultRoom room=%s ===', roomname);
    }
  }

  function removeProducer(roomname, id, kind, mode) {
    if (mode == undefined) {
      return false;
    }
    if (roomname) {
      const room = Room.getRoom(roomname);
      room.removeProducer(id, kind, mode);
    } else {
      defaultRoom.removeProducer(id, kind, mode);
    }
  }

  // --- multi-consumers --
  //   let consumerTransports = {};
  //   let videoConsumers = {};
  //   let audioConsumers = {};

  function getConsumerTrasnport(roomname, id) {
    if (roomname) {
      console.log('=== getConsumerTrasnport use room=%s ===', roomname);
      const room = Room.getRoom(roomname);
      return room.getConsumerTrasnport(id);
    } else {
      console.log(
        '=== getConsumerTrasnport use defaultRoom room=%s ===',
        roomname
      );
      return defaultRoom.getConsumerTrasnport(id);
    }
  }

  function addConsumerTrasport(roomname, id, transport) {
    if (roomname) {
      const room = Room.getRoom(roomname);
      room.addConsumerTrasport(id, transport);
      console.log('=== addConsumerTrasport use room=%s ===', roomname);
    } else {
      defaultRoom.addConsumerTrasport(id, transport);
      console.log(
        '=== addConsumerTrasport use defaultRoom room=%s ===',
        roomname
      );
    }
  }

  function removeConsumerTransport(roomname, id) {
    if (roomname) {
      const room = Room.getRoom(roomname);
      room.removeConsumerTransport(id);
    } else {
      defaultRoom.removeConsumerTransport(id);
    }
  }

  function getConsumer(roomname, localId, remoteId, kind, mode) {
    if (mode == undefined) {
      return;
    }

    if (roomname) {
      const room = Room.getRoom(roomname);
      return room.getConsumer(localId, remoteId, kind, mode);
    } else {
      return defaultRoom.getConsumer(localId, remoteId, kind, mode);
    }
  }

  function addConsumer(roomname, localId, remoteId, consumer, kind, mode) {
    if (mode == undefined) {
      return;
    }

    if (roomname) {
      const room = Room.getRoom(roomname);
      room.addConsumer(localId, remoteId, consumer, kind, mode);
      console.log('=== addConsumer use room=%s ===', roomname);
    } else {
      defaultRoom.addConsumer(localId, remoteId, consumer, kind, mode);
      console.log('=== addConsumer use defaultRoom room=%s ===', roomname);
    }
  }

  function removeConsumer(localId, remoteId, kind, mode) {
    if (mode == undefined) {
      return;
    }
    if (roomname) {
      const room = Room.getRoom(roomname);
      room.removeConsumer(localId, remoteId, kind, mode);
    } else {
      defaultRoom.removeConsumer(localId, remoteId, kind, mode);
    }
  }

  function removeConsumerSetDeep(roomname, localId, mode) {
    if (mode == undefined) {
      return;
    }
    if (roomname) {
      const room = Room.getRoom(roomname);
      room.removeConsumerSetDeep(localId, mode);
    } else {
      defaultRoom.removeConsumerSetDeep(localId, mode);
    }
  }

  async function createTransport(roomname) {
    let router = null;
    if (roomname) {
      const room = Room.getRoom(roomname);
      router = room.router;
    } else {
      router = defaultRoom.router;
    }
    const transport = await router.createWebRtcTransport(
      mediasoupOptions.webRtcTransport
    );
    console.log('-- create transport room=%s id=%s', roomname, transport.id);

    return {
      transport: transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  async function createConsumer(
    roomname,
    transport,
    producer,
    rtpCapabilities
  ) {
    let router = null;
    if (roomname) {
      const room = Room.getRoom(roomname);
      router = room.router;
    } else {
      router = defaultRoom.router;
    }

    if (
      !router.canConsume({
        producerId: producer.id,
        rtpCapabilities,
      })
    ) {
      console.error('can not consume');
      return;
    }

    let consumer = null;
    //consumer = await producerTransport.consume({ // NG: try use same trasport as producer (for loopback)
    consumer = await transport
      .consume({
        // OK
        producerId: producer.id,
        rtpCapabilities,
        paused: producer.kind === 'video',
      })
      .catch((err) => {
        console.error('consume failed', err);
        return;
      });

    //if (consumer.type === 'simulcast') {
    //  await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
    //}

    return {
      consumer: consumer,
      params: {
        producerId: producer.id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
      },
    };
  }
}
module.exports = socketMain;

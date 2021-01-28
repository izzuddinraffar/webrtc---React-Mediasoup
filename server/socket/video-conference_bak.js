function socketMain(io) {
    const conferenceIO = io.of('/video-conference');
    conferenceIO.on('connection', (socket) => {
        //console.log('conference');

        socket.on('disconnect', function () {
            //   close user connection
            console.log(
                'client disconnected. socket id=' +
                    getId(socket) +
                    '  , total clients=' +
                    getClientCount()
            );
            cleanUpPeer(socket);
        });

        socket.on('getRouterRtpCapabilities', (data, callback) => {
            if (router) {
                //console.log(
                //     'getRouterRtpCapabilities: ',
                //     router.rtpCapabilities
                // );
                sendResponse(router.rtpCapabilities, callback);
            } else {
                sendReject({ text: 'ERROR- router NOT READY' }, callback);
            }
        });

        // --- producer ----
        socket.on('createProducerTransport', async (data, callback) => {
            //console.log('-- createProducerTransport ---');
            const mode = data.mode;

            const { transport, params } = await createTransport();
            addProducerTrasport(getId(socket), transport);
            transport.observer.on('close', () => {
                const id = getId(socket);
                const videoProducer = getProducer(id, 'video', mode);
                if (videoProducer) {
                    videoProducer.close();
                    removeProducer(id, 'video');
                }
                const audioProducer = getProducer(id, 'audio', mode);
                if (audioProducer) {
                    audioProducer.close();
                    removeProducer(id, 'audio');
                }
                removeProducerTransport(id);
            });
            ////console.log('-- createProducerTransport params:', params);
            sendResponse(params, callback);
        });

        socket.on('connectProducerTransport', async (data, callback) => {
            const transport = getProducerTrasnport(getId(socket));
            await transport.connect({ dtlsParameters: data.dtlsParameters });
            sendResponse({}, callback);
        });

        socket.on('produce', async (data, callback) => {
            const { kind, rtpParameters, mode } = data;
            //console.log('-- produce --- kind=' + kind);

            const id = getId(socket);
            const transport = getProducerTrasnport(id);
            if (!transport) {
                console.error('transport NOT EXIST for id=' + id);
                return;
            }
            const producer = await transport.produce({ kind, rtpParameters });
            addProducer(id, producer, kind, mode);
            producer.observer.on('close', () => {
                //console.log('producer closed --- kind=' + kind);
            });
            sendResponse({ id: producer.id }, callback);

            // inform clients about new producer
            //console.log('--broadcast newProducer ---');
            socket.broadcast.emit('newProducer', {
                socketId: id,
                producerId: producer.id,
                kind: producer.kind,
                mode: mode,
            });
        });

        // --- consumer ----
        socket.on('createConsumerTransport', async (data, callback) => {
            //console.log('-- createConsumerTransport -- id=' + getId(socket));
            const { transport, params } = await createTransport();
            addConsumerTrasport(getId(socket), transport);
            transport.observer.on('close', () => {
                const localId = getId(socket);
                removeConsumerSetDeep(localId);
                /*
              let consumer = getConsumer(getId(socket));
              if (consumer) {
                consumer.close();
                removeConsumer(id);
              }
              */
                removeConsumerTransport(id);
            });
            ////console.log('-- createTransport params:', params);
            sendResponse(params, callback);
        });

        socket.on('connectConsumerTransport', async (data, callback) => {
            //console.log('-- connectConsumerTransport -- id=' + getId(socket));
            let transport = getConsumerTrasnport(getId(socket));
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
            const clientId = data.localId;
            //console.log('-- getCurrentProducers for Id=' + clientId);

            const remoteVideoIds = getRemoteIds(clientId, 'video');
            //console.log('-- remoteVideoIds:', remoteVideoIds);
            const remoteAudioIds = getRemoteIds(clientId, 'audio');
            //console.log('-- remoteAudioIds:', remoteAudioIds);

            sendResponse(
                {
                    remoteVideoIds: remoteVideoIds,
                    remoteAudioIds: remoteAudioIds,
                },
                callback
            );
        });

        socket.on('consumeAdd', async (data, callback) => {
            const localId = getId(socket);
            const kind = data.kind;
            const mode = data.mode;
            //console.log('-- consumeAdd -- localId=%s kind=%s', localId, kind);

            let transport = getConsumerTrasnport(localId);
            if (!transport) {
                console.error('transport NOT EXIST for id=' + localId);
                return;
            }
            const rtpCapabilities = data.rtpCapabilities;
            const remoteId = data.remoteId;
            //console.log(
            //     '-- consumeAdd - localId=' +
            //         localId +
            //         ' remoteId=' +
            //         remoteId +
            //         ' kind=' +
            //         kind
            // );
            const producer = getProducer(remoteId, kind, mode);
            if (!producer) {
                console.error(
                    'producer NOT EXIST for remoteId=%s kind=%s',
                    remoteId,
                    kind
                );
                return;
            }

            const { consumer, params } = await createConsumer(
                transport,
                producer,
                rtpCapabilities
            ); // producer must exist before consume
            //subscribeConsumer = consumer;
            addConsumer(localId, remoteId, consumer, kind); // TODO: MUST comination of  local/remote id
            //console.log(
            //     'addConsumer localId=%s, remoteId=%s, kind=%s',
            //     localId,
            //     remoteId,
            //     kind
            // );
            consumer.observer.on('close', () => {
                //console.log('consumer closed ---');
            });
            consumer.on('producerclose', () => {
                //console.log('consumer -- on.producerclose');
                consumer.close();
                removeConsumer(localId, remoteId, kind);

                // -- notify to client ---
                socket.emit('producerClosed', {
                    localId: localId,
                    remoteId: remoteId,
                    kind: kind,
                });
            });

            //console.log('-- consumer ready ---');
            sendResponse(params, callback);
        });

        socket.on('resumeAdd', async (data, callback) => {
            const localId = getId(socket);
            const remoteId = data.remoteId;
            const kind = data.kind;
            //console.log(
            //     '-- resumeAdd localId=%s remoteId=%s kind=%s',
            //     localId,
            //     remoteId,
            //     kind
            // );
            let consumer = getConsumer(localId, remoteId, kind);
            if (!consumer) {
                console.error('consumer NOT EXIST for remoteId=' + remoteId);
                return;
            }
            await consumer.resume();
            sendResponse({}, callback);
        });

        // ---- sendback welcome message with on connected ---
        const newId = getId(socket);
        sendback(socket, { type: 'welcome', id: newId });

        // --- send response to client ---
        function sendResponse(response, callback) {
            ////console.log('sendResponse() callback:', callback);
            callback(null, response);
        }

        // --- send error to client ---
        function sendReject(error, callback) {
            callback(error.toString(), null);
        }

        function sendback(socket, message) {
            socket.emit('message', message);
        }

        function getId(socket) {
            return socket.id;
        }

        const getClientCount = async () => {
            // WARN: undocumented method to get clients number

            var nspSockets = await conferenceIO.allSockets();
            //console.log('nspSockets');
            //console.log(nspSockets);
        };

        function cleanUpPeer(socket) {
            const id = getId(socket);
            removeConsumerSetDeep(id);
            /*
            const consumer = getConsumer(id);
            if (consumer) {
              consumer.close();
              removeConsumer(id);
            }
            */

            const transport = getConsumerTrasnport(id);
            if (transport) {
                transport.close();
                removeConsumerTransport(id);
            }

            {
                const videoProducer = getProducer(id, 'video', 'stream');
                if (videoProducer) {
                    videoProducer.close();
                    removeProducer(id, 'video');
                }
            }
            {
                const videoProducer = getProducer(id, 'video', 'share_screen');
                if (videoProducer) {
                    videoProducer.close();
                    removeProducer(id, 'video');
                }
            }
            {
                const audioProducer = getProducer(id, 'audio', 'stream');
                if (audioProducer) {
                    audioProducer.close();
                    removeProducer(id, 'audio');
                }
            }
            {
                const audioProducer = getProducer(id, 'audio', 'share_screen');
                if (audioProducer) {
                    audioProducer.close();
                    removeProducer(id, 'audio');
                }
            }

            const producerTransport = getProducerTrasnport(id);
            if (producerTransport) {
                producerTransport.close();
                removeProducerTransport(id);
            }
        }
    });

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
    let router = null;
    // let producerTransport = null;
    // let videoProducer = null;
    // let audioProducer = null;
    // let producerSocketId = null;
    //let consumerTransport = null;
    //let subscribeConsumer = null;

    async function startWorker() {
        const mediaCodecs = mediasoupOptions.router.mediaCodecs;
        worker = await mediasoup.createWorker();
        router = await worker.createRouter({ mediaCodecs });
        //producerTransport = await router.createWebRtcTransport(mediasoupOptions.webRtcTransport);
        //console.log('-- mediasoup worker start. --');
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
    let producerTransports = {};
    let videoProducers = {};
    let audioProducers = {};

    function getProducerTrasnport(id) {
        return producerTransports[id];
    }

    function addProducerTrasport(id, transport) {
        producerTransports[id] = transport;
        //console.log(
        //     'producerTransports count=' + Object.keys(producerTransports).length
        // );
    }

    function removeProducerTransport(id) {
        delete producerTransports[id];
        //console.log(
        //     'producerTransports count=' + Object.keys(producerTransports).length
        // );
    }

    function getProducer(id, kind, mode) {
        if (kind === 'video') {
            return videoProducers[id] && videoProducers[id][mode];
        } else if (kind === 'audio') {
            return audioProducers[id] && audioProducers[id][mode];
        } else {
            console.warn('UNKNOWN producer kind=' + kind);
        }
    }

    function getRemoteIds(clientId, kind) {
        let remoteIds = [];
        if (kind === 'video') {
            for (const key in videoProducers) {
                if (key !== clientId) {
                    remoteIds.push(key);
                }
            }
        } else if (kind === 'audio') {
            for (const key in audioProducers) {
                if (key !== clientId) {
                    remoteIds.push(key);
                }
            }
        }
        return remoteIds;
    }

    function addProducer(id, producer, kind, mode) {
        if (kind === 'video') {
            if (videoProducers[id] == undefined) {
                videoProducers[id] = {};
            }
            videoProducers[id][mode] = producer;
            console.log('addProducer');
            console.log(mode);
            console.log(videoProducers);
            //console.log(
            //     'videoProducers count=' + Object.keys(videoProducers).length
            // );
        } else if (kind === 'audio') {
            if (audioProducers[id] == undefined) {
                audioProducers[id] = {};
            }
            audioProducers[id][mode] = producer;
            //console.log(
            //     'audioProducers count=' + Object.keys(audioProducers).length
            // );
        } else {
            console.warn('UNKNOWN producer kind=' + kind);
        }
    }

    function removeProducer(id, kind) {
        if (kind === 'video') {
            if (videoProducers[id]) {
                delete videoProducers[id];
            }

            //console.log(
            //     'videoProducers count=' + Object.keys(videoProducers).length
            // );
        } else if (kind === 'audio') {
            if (audioProducers[id]) {
                delete audioProducers[id];
            }

            //console.log(
            //     'audioProducers count=' + Object.keys(audioProducers).length
            // );
        } else {
            console.warn('UNKNOWN producer kind=' + kind);
        }
    }

    // --- multi-consumers --
    let consumerTransports = {};
    let videoConsumers = {};
    let audioConsumers = {};

    function getConsumerTrasnport(id) {
        return consumerTransports[id];
    }

    function addConsumerTrasport(id, transport) {
        consumerTransports[id] = transport;
        //console.log(
        //     'consumerTransports count=' + Object.keys(consumerTransports).length
        // );
    }

    function removeConsumerTransport(id) {
        delete consumerTransports[id];
        //console.log(
        //     'consumerTransports count=' + Object.keys(consumerTransports).length
        // );
    }

    function getConsumerSet(localId, kind) {
        if (kind === 'video') {
            return videoConsumers[localId];
        } else if (kind === 'audio') {
            return audioConsumers[localId];
        } else {
            console.warn('WARN: getConsumerSet() UNKNWON kind=%s', kind);
        }
    }
    function getConsumer(localId, remoteId, kind) {
        const set = getConsumerSet(localId, kind);
        if (set) {
            return set[remoteId];
        } else {
            return null;
        }
    }

    function addConsumer(localId, remoteId, consumer, kind) {
        const set = getConsumerSet(localId, kind);
        if (set) {
            set[remoteId] = consumer;
            //console.log(
            //     'consumers kind=%s count=%d',
            //     kind,
            //     Object.keys(set).length
            // );
        } else {
            //console.log('new set for kind=%s, localId=%s', kind, localId);
            const newSet = {};
            newSet[remoteId] = consumer;
            addConsumerSet(localId, newSet, kind);
            //console.log(
            //     'consumers kind=%s count=%d',
            //     kind,
            //     Object.keys(newSet).length
            // );
        }
    }

    function removeConsumer(localId, remoteId, kind) {
        const set = getConsumerSet(localId, kind);
        if (set) {
            delete set[remoteId];
            //console.log(
            //     'consumers kind=%s count=%d',
            //     kind,
            //     Object.keys(set).length
            // );
        } else {
            //console.log('NO set for kind=%s, localId=%s', kind, localId);
        }
    }

    function removeConsumerSetDeep(localId) {
        const set = getConsumerSet(localId, 'video');
        delete videoConsumers[localId];
        if (set) {
            for (const key in set) {
                const consumer = set[key];
                consumer.close();
                delete set[key];
            }

            //console.log(
            //     'removeConsumerSetDeep video consumers count=' +
            //         Object.keys(set).length
            // );
        }

        const audioSet = getConsumerSet(localId, 'audio');
        delete audioConsumers[localId];
        if (audioSet) {
            for (const key in audioSet) {
                const consumer = audioSet[key];
                consumer.close();
                delete audioSet[key];
            }

            //console.log(
            //     'removeConsumerSetDeep audio consumers count=' +
            //         Object.keys(audioSet).length
            // );
        }
    }

    function addConsumerSet(localId, set, kind) {
        if (kind === 'video') {
            videoConsumers[localId] = set;
        } else if (kind === 'audio') {
            audioConsumers[localId] = set;
        } else {
            console.warn('WARN: addConsumerSet() UNKNWON kind=%s', kind);
        }
    }

    async function createTransport() {
        const transport = await router.createWebRtcTransport(
            mediasoupOptions.webRtcTransport
        );
        //console.log('-- create transport id=' + transport.id);

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

    async function createConsumer(transport, producer, rtpCapabilities) {
        let consumer = null;
        if (
            !router.canConsume({
                producerId: producer.id,
                rtpCapabilities,
            })
        ) {
            console.error('can not consume');
            return;
        }

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

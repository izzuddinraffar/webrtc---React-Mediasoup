import React, { Suspense, lazy } from 'react';
import { Device } from 'mediasoup-client';
import { io as socketIOClient } from 'socket.io-client';
import { config } from '../../app.config';
function Subscribe(props: any) {
    const remoteVideo: any = React.useRef();
    const localStream: any = React.useRef();
    const clientId: any = React.useRef();
    const device: any = React.useRef();
    const consumerTransport: any = React.useRef();
    const videoConsumer: any = React.useRef();
    const audioConsumer: any = React.useRef();
    const socketRef: any = React.useRef();

    const [isSubscribed, setIsSubscribed] = React.useState(false);

    const [isConnected, setIsConnected] = React.useState(false);

    // return Promise
    function playVideo(element: any, stream: any) {
        if (element.srcObject) {
            console.warn('element ALREADY playing, so ignore');
            return;
        }
        element.srcObject = stream;
        element.volume = 0;
        remoteVideo.current = element;
        console.log('playVideo');
        console.log(remoteVideo);
        return element.play();
    }

    function pauseVideo(element: any) {
        element.pause();
        element.srcObject = null;
    }

    function addRemoteTrack(id: any, track: any) {
        let video: any = remoteVideo.current;

        if (video.srcObject) {
            video.srcObject.addTrack(track);
            return;
        }

        const newStream = new MediaStream();
        newStream.addTrack(track);
        playVideo(video, newStream)
            .then(() => {
                video.volume = 1.0;
            })
            .catch((err: any) => {
                console.error('media ERROR:', err);
            });
    }

    // ============ UI button ==========

    async function handleSubscribe() {
        //if (!socketRef.current) {
        await connectSocket().catch((err: any) => {
            console.error(err);
            return;
        });
        // }

        // --- get capabilities --
        const data = await sendRequest('getRouterRtpCapabilities', {});
        console.log('getRouterRtpCapabilities:', data);
        await loadDevice(data);
        // }

        // --- prepare transport ---
        console.log('--- createConsumerTransport --');
        const params = await sendRequest('createConsumerTransport', {});
        console.log('transport params:', params);
        consumerTransport.current = device.current.createRecvTransport(params);
        console.log('createConsumerTransport:', consumerTransport);

        // --- NG ---
        //sendRequest('connectConsumerTransport', { dtlsParameters: dtlsParameters })
        //  .then(callback)
        //  .catch(errback);

        // --- try --- not well
        //sendRequest('connectConsumerTransport', { dtlsParameters: params.dtlsParameters })
        //  .then(() => console.log('connectConsumerTransport OK'))
        //  .catch(err => console.error('connectConsumerTransport ERROR:', err));

        // --- join & start publish --
        consumerTransport.current.on(
            'connect',
            async ({ dtlsParameters }: any, callback: any, errback: any) => {
                console.log('--consumer trasnport connect');
                sendRequest('connectConsumerTransport', {
                    dtlsParameters: dtlsParameters,
                })
                    .then(callback)
                    .catch(errback);

                //consumer = await consumeAndResume(consumerTransport);
            }
        );

        consumerTransport.current.on('connectionstatechange', (state: any) => {
            switch (state) {
                case 'connecting':
                    console.log('subscribing...');
                    break;

                case 'connected':
                    console.log('subscribed');
                    setIsSubscribed(true);
                    break;

                case 'failed':
                    console.log('failed');
                    consumerTransport.current.close();
                    break;

                default:
                    break;
            }
        });

        videoConsumer.current = await consumeAndResume(
            consumerTransport.current,
            'video'
        );
        audioConsumer.current = await consumeAndResume(
            consumerTransport.current,
            'audio'
        );
    }

    async function consumeAndResume(transport: any, kind: any) {
        const consumer = await consume(transport, kind);
        if (consumer) {
            console.log('-- track exist, consumer ready. kind=' + kind);

            if (kind === 'video') {
                console.log('-- resume kind=' + kind);
                sendRequest('resume', { kind: kind })
                    .then(() => {
                        console.log('resume OK');
                        return consumer;
                    })
                    .catch((err) => {
                        console.error('resume ERROR:', err);
                        return consumer;
                    });
            } else {
                console.log('-- do not resume kind=' + kind);
            }
        } else {
            console.log('-- no consumer yet. kind=' + kind);
            return null;
        }
    }

    function handleDisconnect() {
        if (videoConsumer.current) {
            videoConsumer.current.close();
            videoConsumer.current = null;
        }
        if (audioConsumer.current) {
            audioConsumer.current.close();
            audioConsumer.current = null;
        }
        if (consumerTransport.current) {
            consumerTransport.current.close();
            consumerTransport.current = null;
        }

        removeAllRemoteVideo();

        disconnectSocket();
        setIsSubscribed(false);
    }

    async function loadDevice(routerRtpCapabilities: any) {
        try {
            device.current = new Device();
        } catch (error) {
            if (error.name === 'UnsupportedError') {
                console.error('browser not supported');
            }
        }
        await device.current.load({ routerRtpCapabilities });
    }

    async function consume(transport: any, trackKind: any) {
        console.log('--start of consume --kind=' + trackKind);
        const { rtpCapabilities } = device.current;
        //const data = await socket.request('consume', { rtpCapabilities });
        const data = await sendRequest('consume', {
            rtpCapabilities: rtpCapabilities,
            kind: trackKind,
        }).catch((err) => {
            console.error('consume ERROR:', err);
        });
        const { producerId, id, kind, rtpParameters }: any = data;

        if (producerId) {
            let codecOptions = {};
            const consumer = await transport.consume({
                id,
                producerId,
                kind,
                rtpParameters,
                codecOptions,
            });
            //const stream = new MediaStream();
            //stream.addTrack(consumer.track);

            addRemoteTrack(clientId.current, consumer.track);

            console.log('--end of consume');
            //return stream;

            return consumer;
        } else {
            console.warn('--- remote producer NOT READY');

            return null;
        }
    }

    function sendRequest(type: any, data: any) {
        return new Promise((resolve: any, reject: any) => {
            socketRef.current.emit(type, data, (err: any, response: any) => {
                if (!err) {
                    // Success response, so pass the mediasoup response to the local Room.
                    resolve(response);
                } else {
                    reject(err);
                }
            });
        });
    }
    function disconnectSocket() {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
            clientId.current = null;
            console.log('socket.io closed..');
        }
    }

    const connectSocket: any = () => {
        if (socketRef.current == null) {
            const io: any = socketIOClient(
                config.SERVER_ENDPOINT + '/video-broadcast'
            );
            socketRef.current = io;
        }

        return new Promise((resolve: any, reject: any) => {
            const socket = socketRef.current;
            socket.on('connect', function (evt: any) {
                console.log('socket.io connected()');
            });
            socket.on('error', function (err: any) {
                console.error('socket.io ERROR:', err);
                reject(err);
            });
            socket.on('message', function (message: any) {
                console.log('socket.io message:', message);
                if (message.type === 'welcome') {
                    if (socket.id !== message.id) {
                        console.warn(
                            'WARN: something wrong with clientID',
                            socket.io,
                            message.id
                        );
                    }

                    clientId.current = message.id;
                    console.log(
                        'connected to server. clientId=' + clientId.current
                    );
                    resolve();
                } else {
                    console.error('UNKNOWN message from server:', message);
                }
            });
            socket.on('newProducer', async function (message: any) {
                console.log('socket.io newProducer:', message);
                if (consumerTransport.current) {
                    // start consume
                    if (message.kind === 'video') {
                        videoConsumer.current = await consumeAndResume(
                            consumerTransport.current,
                            message.kind
                        );
                    } else if (message.kind === 'audio') {
                        audioConsumer.current = await consumeAndResume(
                            consumerTransport.current,
                            message.kind
                        );
                    }
                }
            });

            socket.on('producerClosed', function (message: any) {
                console.log('socket.io producerClosed:', message);
                const localId = message.localId;
                const remoteId = message.remoteId;
                const kind = message.kind;
                console.log(
                    '--try removeConsumer remoteId=' +
                        remoteId +
                        ', localId=' +
                        localId +
                        ', kind=' +
                        kind
                );
                if (kind === 'video') {
                    if (videoConsumer.current) {
                        videoConsumer.current.close();
                        videoConsumer.current = null;
                    }
                } else if (kind === 'audio') {
                    if (audioConsumer.current) {
                        audioConsumer.current.close();
                        audioConsumer.current = null;
                    }
                }

                if (remoteId) {
                    removeRemoteVideo(remoteId);
                } else {
                    removeAllRemoteVideo();
                }
            });
        });
    };

    function removeRemoteVideo(id: any) {
        console.log(' ---- removeRemoteVideo() id=' + id);
    }

    function removeAllRemoteVideo() {
        // remoteVideo.current = null;
        if (remoteVideo.current) {
            remoteVideo.current.pause();
            remoteVideo.current.srcObject = null;
        }
    }

    return (
        <div>
            <button disabled={isSubscribed} onClick={handleSubscribe}>
                Subscribe
            </button>
            <button disabled={!isSubscribed} onClick={handleDisconnect}>
                Disconnect
            </button>

            <div>
                remote video
                <br />
                <div>
                    <video
                        ref={remoteVideo}
                        autoPlay
                        style={{
                            width: '240px',
                            height: '180px',
                            border: '1px solid black',
                        }}
                    ></video>
                </div>
            </div>
        </div>
    );
}

export default Subscribe;

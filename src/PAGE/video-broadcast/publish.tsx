import React, { Suspense, lazy } from 'react';
import { Device } from 'mediasoup-client';
import { io as socketIOClient } from 'socket.io-client';
import { config } from '../../app.config';
function Publish(props: any) {
    const localVideo: any = React.useRef();
    const localStream: any = React.useRef();
    const clientId: any = React.useRef();
    const device: any = React.useRef();
    const producerTransport: any = React.useRef();
    const videoProducer: any = React.useRef();
    const audioProducer: any = React.useRef();
    const socketRef: any = React.useRef();

    const [useVideo, setUseVideo] = React.useState(true);
    const [useAudio, setUseAudio] = React.useState(true);
    const [isStartMedia, setIsStartMedia] = React.useState(false);
    const [isPublished, setIsPublished] = React.useState(false);

    // ============ UI button ==========
    const handleUseVideo = (e: any) => {
        setUseVideo(!useVideo);
    };
    const handleUseAudio = (e: any) => {
        setUseAudio(!useAudio);
    };

    const handleStartMedia = () => {
        if (localStream.current) {
            console.warn('WARN: local media ALREADY started');
            return;
        }

        navigator.mediaDevices
            .getUserMedia({ audio: useAudio, video: useVideo })
            .then((stream: any) => {
                localStream.current = stream;
                playVideo(localVideo.current, localStream.current);
                setIsStartMedia(true);
            })
            .catch((err) => {
                console.error('media ERROR:', err);
            });
    };

    function playVideo(element: any, stream: any) {
        if (element.srcObject) {
            console.warn('element ALREADY playing, so ignore');
            return;
        }
        element.srcObject = stream;
        element.volume = 0;
        return element.play();
    }

    function pauseVideo(element: any) {
        element.pause();
        element.srcObject = null;
    }

    function stopLocalStream(stream: any) {
        let tracks = stream.getTracks();
        if (!tracks) {
            console.warn('NO tracks');
            return;
        }

        tracks.forEach((track: any) => track.stop());
    }

    function handleStopMedia() {
        if (localStream.current) {
            pauseVideo(localVideo.current);
            stopLocalStream(localStream.current);
            localStream.current = null;
            setIsStartMedia(false);
        }
    }

    async function handlePublish() {
        if (!localStream.current) {
            console.warn('WARN: local media NOT READY');
            return;
        }

        // --- connect socket.io ---
        if (!socketRef.current) {
            await connectSocket().catch((err: any) => {
                console.error(err);
                return;
            });
        }
        // --- get capabilities --
        const data = await sendRequest('getRouterRtpCapabilities', {});
        console.log('getRouterRtpCapabilities:', data);
        await loadDevice(data);
        //  }

        // --- get transport info ---
        console.log('--- createProducerTransport --');
        const params = await sendRequest('createProducerTransport', {});
        console.log('transport params:', params);
        producerTransport.current = device.current.createSendTransport(params);
        console.log('createSendTransport:', producerTransport);

        // --- join & start publish --
        producerTransport.current.on(
            'connect',
            async ({ dtlsParameters }: any, callback: any, errback: any) => {
                console.log('--trasnport connect');
                sendRequest('connectProducerTransport', {
                    dtlsParameters: dtlsParameters,
                })
                    .then(callback)
                    .catch(errback);
            }
        );

        producerTransport.current.on(
            'produce',
            async (
                { kind, rtpParameters }: any,
                callback: any,
                errback: any
            ) => {
                console.log('--trasnport produce');
                try {
                    const { id }: any = await sendRequest('produce', {
                        transportId: producerTransport.current.id,
                        kind,
                        rtpParameters,
                    });
                    callback({ id });
                } catch (err) {
                    errback(err);
                }
            }
        );

        producerTransport.current.on('connectionstatechange', (state: any) => {
            switch (state) {
                case 'connecting':
                    console.log('publishing...');
                    break;

                case 'connected':
                    console.log('published');
                    setIsPublished(true);
                    break;

                case 'failed':
                    console.log('failed');
                    producerTransport.current.close();
                    break;

                default:
                    break;
            }
        });

        if (useVideo) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                const trackParams = { track: videoTrack };
                videoProducer.current = await producerTransport.current.produce(
                    trackParams
                );
            }
        }
        if (useAudio) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            if (audioTrack) {
                const trackParams = { track: audioTrack };
                audioProducer.current = await producerTransport.current.produce(
                    trackParams
                );
            }
        }
    }

    function handleDisconnect() {
        if (localStream.current) {
            pauseVideo(localVideo.current);
            stopLocalStream(localStream.current);
            localStream.current = null;
        }
        if (videoProducer.current) {
            videoProducer.current.close(); // localStream will stop
            videoProducer.current = null;
        }
        if (audioProducer.current) {
            audioProducer.current.close(); // localStream will stop
            audioProducer.current = null;
        }
        if (producerTransport.current) {
            producerTransport.current.close(); // localStream will stop
            producerTransport.current = null;
        }

        disconnectSocket();
        setIsPublished(false);
        setIsStartMedia(false);
    }

    const loadDevice = async (routerRtpCapabilities: any) => {
        try {
            device.current = new Device();
            console.log('device.current');
            console.log(device.current);
        } catch (error) {
            if (error.name === 'UnsupportedError') {
                console.error('browser not supported');
            }
        }

        console.log('device.current start');
        console.log(device.current);
        console.log('device.current end');
        await device.current.load({ routerRtpCapabilities });
    };

    function disconnectSocket() {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
            clientId.current = null;
            console.log('socket.io closed..');
        }
    }

    function sendRequest(type: any, data: any) {
        return new Promise((resolve, reject) => {
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
                console.warn('IGNORE socket.io newProducer:', message);
            });
        });
    };

    return (
        <div>
            <div>
                <input
                    disabled={isStartMedia}
                    onChange={handleUseVideo}
                    type='checkbox'
                    checked={useVideo}
                ></input>
                <label>video</label>
            </div>
            <div>
                <input
                    disabled={isStartMedia}
                    onChange={handleUseAudio}
                    type='checkbox'
                    checked={useAudio}
                ></input>
                <label>audio</label>
            </div>
            <button disabled={isStartMedia} onClick={handleStartMedia}>
                Start Media
            </button>
            <button
                disabled={!isStartMedia || isPublished}
                onClick={handleStopMedia}
            >
                Stop Media
            </button>

            <button
                disabled={isPublished || !isStartMedia}
                onClick={handlePublish}
            >
                publish
            </button>
            <button
                disabled={!isPublished || !isStartMedia}
                onClick={handleDisconnect}
            >
                Disconnect
            </button>
            <div>
                local video
                <video
                    ref={localVideo}
                    autoPlay
                    style={{
                        width: '240px',
                        height: '180px',
                        border: '1px solid black',
                    }}
                ></video>
            </div>
        </div>
    );
}

export default Publish;

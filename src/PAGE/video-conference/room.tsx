import React, { Suspense, lazy } from 'react';
import { Device } from 'mediasoup-client';
import { io as socketIOClient } from 'socket.io-client';
import { config } from '../../app.config';

const MODE_STREAM = 'stream';
const MODE_SHARE_SCREEN = 'share_screen';

const CreateRemoteVideos = (props: any) => {
  const remoteVideo: any = React.useRef();

  // ============ STREAMING CONTROL START ==========
  const [enableVideoStream, setEnableVideoStream] = React.useState(true);
  const [enableAudioStream, setEnableAudioStream] = React.useState(true);

  const handleEnableVideoStream = (stream: any, cond: boolean) => {
    if (!stream) {
      return false;
    }
    stream.getVideoTracks()[0].enabled = cond;
    setEnableVideoStream(cond);
  };
  const handleEnableAudioStream = (stream: any, cond: boolean) => {
    if (!stream) {
      return false;
    }
    stream.getAudioTracks()[0].enabled = cond;
    setEnableAudioStream(cond);
  };
  // ============ STREAMING CONTROL END ==========

  React.useEffect(() => {
    // if (remoteVideo.current.srcObject) {
    //     remoteVideo.current.srcObject.addTrack(props.track);
    //         return;
    //     }
    console.log('CreateRemoteVideos');
    console.log(props);
    props
      .playVideo(remoteVideo.current, props.peer.stream)
      ?.then(() => {
        remoteVideo.current.volume = 1;
        console.log('remoteVideo.current');
        console.log(remoteVideo.current);
      })
      .catch((err: any) => {
        console.error('media ERROR:', err);
      });
  }, []);
  return (
    <div>
      <div>
        <video
          ref={remoteVideo}
          autoPlay
          style={{
            width: '360px',
            height: '240px',
            border: '1px solid black',
          }}
        ></video>
      </div>

      {props.mode == MODE_STREAM ? (
        <div>
          {!enableVideoStream ? (
            <button
              onClick={() => handleEnableVideoStream(props.peer.stream, true)}
            >
              Enable Video
            </button>
          ) : (
            <button
              onClick={() => handleEnableVideoStream(props.peer.stream, false)}
            >
              Disable Video
            </button>
          )}
          {!enableAudioStream ? (
            <button
              onClick={() => handleEnableAudioStream(props.peer.stream, true)}
            >
              Enable Audio
            </button>
          ) : (
            <button
              onClick={() => handleEnableAudioStream(props.peer.stream, false)}
            >
              Disable Audio
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};
export const MemoizedCreateRemoteVideos = React.memo(CreateRemoteVideos);

function MeetRoom(props: any) {
  const localScreen: any = React.useRef();
  const localStreamScreen: any = React.useRef();

  const localVideo: any = React.useRef();
  const localStream: any = React.useRef();
  const clientId: any = React.useRef();
  const device: any = React.useRef();
  const producerTransport: any = React.useRef();
  const videoProducer: any = React.useRef({});
  const audioProducer: any = React.useRef({});
  const consumerTransport: any = React.useRef();
  const videoConsumers: any = React.useRef({});
  const audioConsumers: any = React.useRef({});
  const consumersStream: any = React.useRef({});
  const socketRef: any = React.useRef();

  const [useVideo, setUseVideo] = React.useState(true);
  const [useAudio, setUseAudio] = React.useState(true);
  const [isStartMedia, setIsStartMedia] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [remoteVideos, setRemoteVideos]: any = React.useState({});
  const [isShareScreen, setIsShareScreen] = React.useState(false);
  const [roomName, setRoomName]: any = React.useState('');

  // ============ STREAMING CONTROL START ==========
  const [enableVideoStream, setEnableVideoStream] = React.useState(useVideo);
  const [enableAudioStream, setEnableAudioStream] = React.useState(useAudio);

  const [enableVideoShare, setEnableVideoShare] = React.useState(useVideo);
  const [enableAudioShare, setEnableAudioShare] = React.useState(useAudio);

  const handleEnableVideoStream = (stream: any, cond: boolean) => {
    if (!stream) {
      return false;
    }
    stream.getVideoTracks()[0].enabled = cond;
    setEnableVideoStream(cond);
  };
  const handleEnableAudioStream = (stream: any, cond: boolean) => {
    if (!stream) {
      return false;
    }
    stream.getAudioTracks()[0].enabled = cond;
    setEnableAudioStream(cond);
  };
  const handleEnableVideoShare = (stream: any, cond: boolean) => {
    if (!stream) {
      return false;
    }
    stream.getVideoTracks()[0].enabled = cond;
    setEnableVideoShare(cond);
  };
  const handleEnableAudioShare = (stream: any, cond: boolean) => {
    if (!stream) {
      return false;
    }
    stream.getAudioTracks()[0].enabled = cond;
    setEnableAudioShare(cond);
  };

  // ============STREAMING CONTROL END ==========
  // ============ ROOM START ==========

  const handleRoomName = (e: any) => {
    setRoomName(e.target.value);
  };
  // ============ ROOM END ==========

  // ============ SHARE SCREEN START ==========
  const handleStartScreenShare = () => {
    if (localStreamScreen.current) {
      console.warn('WARN: local media ALREADY started');
      return;
    }

    const mediaDevices: any = navigator.mediaDevices;
    mediaDevices
      .getDisplayMedia({ audio: useAudio, video: useVideo })
      .then((stream: any) => {
        localStreamScreen.current = stream;

        playVideo(localScreen.current, localStreamScreen.current);
        handleConnectScreenShare();
        setIsShareScreen(true);
        const screenTrack = stream.getTracks()[0];
        screenTrack.onended = function () {
          handleDisconnectScreenShare();
        };
      })
      .catch((err: any) => {
        console.error('media ERROR:', err);
      });
  };

  async function handleConnectScreenShare() {
    if (!localStreamScreen.current) {
      console.warn('WARN: local media NOT READY');
      return;
    }

    // // --- connect socket.io ---
    // await connectSocket().catch((err: any) => {
    //     console.error(err);
    //     return;
    // });

    // console.log('connected');

    // --- get capabilities --
    const data = await sendRequest('getRouterRtpCapabilities', {});
    console.log('getRouterRtpCapabilities:', data);
    await loadDevice(data);

    // --- get transport info ---
    console.log('--- createProducerTransport --');
    const params = await sendRequest('createProducerTransport', {
      mode: MODE_SHARE_SCREEN,
    });
    console.log('transport params:', params);
    producerTransport.current = device.current.createSendTransport(params);
    console.log('createSendTransport:', producerTransport.current);

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
      async ({ kind, rtpParameters }: any, callback: any, errback: any) => {
        console.log('--trasnport produce');
        try {
          const { id }: any = await sendRequest('produce', {
            transportId: producerTransport.current.id,
            kind,
            rtpParameters,
            mode: MODE_SHARE_SCREEN,
          });
          callback({ id });
          console.log('--produce requested, then subscribe ---');
          subscribe();
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
          //  setIsConnected(true);
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
      const videoTrack = localStreamScreen.current.getVideoTracks()[0];
      if (videoTrack) {
        const trackParams = { track: videoTrack };
        videoProducer.current[
          MODE_SHARE_SCREEN
        ] = await producerTransport.current.produce(trackParams);
      }
    }
    if (useAudio) {
      const audioTrack = localStreamScreen.current.getAudioTracks()[0];
      if (audioTrack) {
        const trackParams = { track: audioTrack };
        audioProducer.current[
          MODE_SHARE_SCREEN
        ] = await producerTransport.current.produce(trackParams);
      }
    }
  }

  function handleStopScreenShare() {
    if (localStreamScreen.current) {
      pauseVideo(localScreen.current);
      stopLocalStream(localStreamScreen.current);
      localStreamScreen.current = null;
      setIsShareScreen(false);
    }
  }
  async function handleDisconnectScreenShare() {
    handleStopScreenShare();
    {
      const producer = videoProducer.current[MODE_SHARE_SCREEN];
      producer?.close();
      delete videoProducer.current[MODE_SHARE_SCREEN];
    }
    {
      const producer = audioProducer.current[MODE_SHARE_SCREEN];
      producer?.close();
      delete audioProducer.current[MODE_SHARE_SCREEN];
    }

    await sendRequest('producerStopShareScreen', {});
  }

  // ============ SHARE SCREEN END ==========

  // ============ MEDIA START ==========

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
      .catch((err: any) => {
        console.error('media ERROR:', err);
      });
  };

  function handleStopMedia() {
    if (localStream.current) {
      pauseVideo(localVideo.current);
      stopLocalStream(localStream.current);
      localStream.current = null;
      setIsStartMedia(false);
    }
  }

  function handleDisconnect() {
    handleStopMedia();
    handleStopScreenShare();
    // if (videoProducer.current) {
    //     videoProducer.current.close(); // localStream will stop
    //     videoProducer.current = null;
    // }
    {
      for (const mode in videoProducer.current) {
        const producer = videoProducer.current[mode];
        producer?.close();
        delete videoProducer.current[mode];
      }
    }
    {
      for (const mode in audioProducer.current) {
        const producer = audioProducer.current[mode];
        producer?.close();
        delete audioProducer.current[mode];
      }
    }
    // if (audioProducer.current) {
    //     audioProducer.current.close(); // localStream will stop
    //     audioProducer.current = null;
    // }
    if (producerTransport.current) {
      producerTransport.current.close(); // localStream will stop
      producerTransport.current = null;
    }

    for (const key in videoConsumers.current) {
      for (const key2 in videoConsumers.current[key]) {
        const consumer = videoConsumers.current[key][key2];
        consumer.close();
        delete videoConsumers.current[key][key2];
      }
    }
    for (const key in audioConsumers.current) {
      for (const key2 in audioConsumers.current[key]) {
        const consumer = audioConsumers.current[key][key2];
        consumer.close();
        delete audioConsumers.current[key][key2];
      }
    }

    if (consumersStream.current) {
      consumersStream.current = {};
    }

    if (consumerTransport.current) {
      consumerTransport.current.close();
      consumerTransport.current = null;
    }

    removeAllRemoteVideo();

    disconnectSocket();
    setIsConnected(false);
  }

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

  function addRemoteTrack(id: any, track: any, mode: string) {
    // let video: any = findRemoteVideo(id);
    // if (!video) {
    //     video = addRemoteVideo(id);
    //     video.controls = '1';
    // }

    // if (video.srcObject) {
    //     video.srcObject.addTrack(track);
    //     return;
    // }

    if (id === clientId.current) {
      return false;
    }

    console.log('addremotetrack');
    console.log(track);

    if (consumersStream.current[id] == undefined) {
      consumersStream.current[id] = {};
    }

    if (consumersStream.current[id][mode] == undefined) {
      const newStream = new MediaStream();
      newStream.addTrack(track);
      consumersStream.current[id][mode] = {
        stream: newStream,
        socket_id: id,
      };
    } else {
      //add audiotrack
      consumersStream.current[id][mode].stream.addTrack(track);
    }

    setRemoteVideos((peers: any) => {
      const newPeers: any = peers;

      return { ...consumersStream.current };
    });

    // setRemoteVideos((peers: any) => {
    //     const newPeers: any = peers;
    //     if (newPeers[id] == undefined) {
    //         newPeers[id] = {};
    //     }
    //     newPeers[id][mode] = {
    //         stream: newStream,
    //         socket_id: id,
    //     };
    //     return { ...peers, ...newPeers };
    // });
    // setShouldLoadConsumerShareScreen

    // playVideo(video, newStream)
    //     .then(() => {
    //         video.volume = 1.0;
    //     })
    //     .catch((err: any) => {
    //         console.error('media ERROR:', err);
    //     });
  }

  function addRemoteVideo(id: any) {
    let existElement = findRemoteVideo(id);
    if (existElement) {
      console.warn('remoteVideo element ALREADY exist for id=' + id);
      return existElement;
    }

    let element = document.createElement('video');
    return element;
  }

  function findRemoteVideo(id: any) {
    let element = remoteVideos.current[id];
    return element;
  }

  // function removeRemoteVideoByMode(id: any, mode: string) {
  //     console.log(' ---- removeRemoteVideo() id=' + id);
  //     delete consumersStream.current[id][mode];
  //     setRemoteVideos((peers: any) => {
  //         const newPeers: any = peers;
  //         delete newPeers[id][mode];

  //         return { ...peers, ...newPeers };
  //     });
  // }

  function removeRemoteVideo(id: any, mode: string) {
    console.log(' ---- removeRemoteVideo() id=' + id);
    if (mode == MODE_STREAM) {
      delete consumersStream.current[id];
    } else {
      delete consumersStream.current[id][mode];
    }

    setRemoteVideos((peers: any) => {
      const newPeers: any = peers;
      delete newPeers[id];

      return { ...consumersStream.current };
    });
    // if (element) {
    //     element.pause();
    //     element.srcObject = null;
    //     remoteContainer.removeChild(element);
    // } else {
    //     console.log('child element NOT FOUND');
    // }
  }

  function removeAllRemoteVideo() {
    console.log(' ---- removeAllRemoteVideo() id');
    consumersStream.current = {};
    setRemoteVideos((peers: any) => {
      const newPeers = {};

      return { ...newPeers };
    });
    // while (remoteContainer.firstChild) {
    //     remoteContainer.firstChild.pause();
    //     remoteContainer.firstChild.srcObject = null;
    //     remoteContainer.removeChild(remoteContainer.firstChild);
    // }
  }

  async function consumeAdd(
    transport: any,
    remoteSocketId: any,
    prdId: any,
    trackKind: any,
    mode: any = MODE_STREAM
  ) {
    console.log('--start of consumeAdd -- kind=%s', trackKind);
    const { rtpCapabilities } = device.current;
    //const data = await socket.request('consume', { rtpCapabilities });
    const data = await sendRequest('consumeAdd', {
      rtpCapabilities: rtpCapabilities,
      remoteId: remoteSocketId,
      kind: trackKind,
      mode: mode,
    }).catch((err) => {
      console.error('consumeAdd ERROR:', err);
    });
    const { producerId, id, kind, rtpParameters }: any = data;
    if (prdId && prdId !== producerId) {
      console.warn('producerID NOT MATCH');
    }

    let codecOptions = {};
    const consumer = await transport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
      codecOptions,
      mode,
    });
    //const stream = new MediaStream();
    //stream.addTrack(consumer.track);

    addConsumer(remoteSocketId, consumer, kind, mode);
    consumer.remoteId = remoteSocketId;
    consumer.on('transportclose', () => {
      console.log('--consumer transport closed. remoteId=' + consumer.remoteId);
      //consumer.close();
      //removeConsumer(remoteId);
      //removeRemoteVideo(consumer.remoteId);
    });
    consumer.on('producerclose', () => {
      console.log('--consumer producer closed. remoteId=' + consumer.remoteId);
      consumer.close();
      removeConsumer(consumer.remoteId, kind, mode);
      removeRemoteVideo(consumer.remoteId, mode);
    });
    consumer.on('trackended', () => {
      console.log('--consumer trackended. remoteId=' + consumer.remoteId);
      //consumer.close();
      //removeConsumer(remoteId);
      //removeRemoteVideo(consumer.remoteId);
    });

    console.log('--end of consumeAdd');
    //return stream;

    if (kind === 'video') {
      console.log('--try resumeAdd --');
      sendRequest('resumeAdd', {
        remoteId: remoteSocketId,
        kind: kind,
        mode,
      })
        .then(() => {
          console.log('resumeAdd OK');
        })
        .catch((err) => {
          console.error('resumeAdd ERROR:', err);
        });
    }
    return new Promise((resolve: any, reject: any) => {
      addRemoteTrack(remoteSocketId, consumer.track, mode);
      resolve();
    });
  }

  async function handleConnect() {
    if (!localStream.current) {
      console.warn('WARN: local media NOT READY');
      return;
    }

    // --- connect socket.io ---
    await connectSocket().catch((err: any) => {
      console.error(err);
      return;
    });

    console.log('connected');

    // --- get capabilities --
    const data = await sendRequest('getRouterRtpCapabilities', {});
    console.log('getRouterRtpCapabilities:', data);
    await loadDevice(data);

    // --- get transport info ---
    console.log('--- createProducerTransport --');
    const params = await sendRequest('createProducerTransport', {
      mode: MODE_STREAM,
    });
    console.log('transport params:', params);
    producerTransport.current = device.current.createSendTransport(params);
    console.log('createSendTransport:', producerTransport.current);

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
      async ({ kind, rtpParameters }: any, callback: any, errback: any) => {
        console.log('--trasnport produce');
        try {
          const { id }: any = await sendRequest('produce', {
            transportId: producerTransport.current.id,
            kind,
            rtpParameters,
            mode: MODE_STREAM,
          });
          callback({ id });
          console.log('--produce requested, then subscribe ---');
          subscribe();
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
          setIsConnected(true);
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
        videoProducer.current[
          MODE_STREAM
        ] = await producerTransport.current.produce(trackParams);
      }
    }
    if (useAudio) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        const trackParams = { track: audioTrack };
        audioProducer.current[
          MODE_STREAM
        ] = await producerTransport.current.produce(trackParams);
      }
    }
  }

  async function subscribe() {
    // console.log(socketRef.current);
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

    // --- prepare transport ---
    console.log('--- createConsumerTransport --');
    if (!consumerTransport.current) {
      const params = await sendRequest('createConsumerTransport', {});
      console.log('transport params:', params);
      consumerTransport.current = device.current.createRecvTransport(params);
      console.log('createConsumerTransport:', consumerTransport.current);

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
        }
      );

      consumerTransport.current.on('connectionstatechange', (state: any) => {
        switch (state) {
          case 'connecting':
            console.log('subscribing...');
            break;

          case 'connected':
            console.log('subscribed');
            //consumeCurrentProducers(clientId);
            break;

          case 'failed':
            console.log('failed');
            producerTransport.current.close();
            break;

          default:
            break;
        }
      });

      consumeCurrentProducers(clientId.current);
    }
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

  async function consumeCurrentProducers(clientId: any) {
    console.log('-- try consuleAll() --');
    const remoteInfo: any = await sendRequest('getCurrentProducers', {
      localId: clientId,
    }).catch((err) => {
      console.error('getCurrentProducers ERROR:', err);
      return;
    });
    //console.log('remoteInfo.producerIds:', remoteInfo.producerIds);
    console.log('remoteInfo.remoteVideoIds:', remoteInfo.remoteVideoIds);
    console.log('remoteInfo.remoteAudioIds:', remoteInfo.remoteAudioIds);
    consumeAll(
      consumerTransport.current,
      remoteInfo.remoteVideoIds,
      remoteInfo.remoteAudioIds
    );
  }

  function consumeAll(transport: any, remoteVideoIds: any, remotAudioIds: any) {
    console.log('----- consumeAll() -----');

    remoteVideoIds.forEach((rId: any) => {
      consumeAdd(transport, rId, null, 'video', MODE_STREAM).then(
        (resp: any) => {
          consumeAdd(transport, rId, null, 'video', MODE_SHARE_SCREEN);
        }
      );
    });
    let audioIdsCount = 0;
    remotAudioIds.forEach((rId: any) => {
      consumeAdd(transport, rId, null, 'audio', MODE_STREAM).then(
        (resp: any) => {
          consumeAdd(transport, rId, null, 'audio', MODE_SHARE_SCREEN);
        }
      );
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

  function removeConsumer(id: any, kind: any, mode: string) {
    if (mode == undefined) {
      return false;
    }
    if (kind === 'video') {
      if (mode == MODE_STREAM) {
        delete videoConsumers.current[id];
      } else {
        delete videoConsumers.current[id][mode];
      }

      console.log(
        'videoConsumers count=' + Object.keys(videoConsumers.current).length
      );
    } else if (kind === 'audio') {
      if (mode == MODE_STREAM) {
        delete audioConsumers.current[id];
      } else {
        delete audioConsumers.current[id][mode];
      }

      console.log(
        'audioConsumers count=' + Object.keys(audioConsumers.current).length
      );
    } else {
      console.warn('UNKNOWN consumer kind=' + kind);
    }
  }

  // function getConsumer(id: any, kind: any) {
  //     if (kind === 'video') {
  //         return videoConsumers.current[id];
  //     } else if (kind === 'audio') {
  //         return audioConsumers.current[id];
  //     } else {
  //         console.warn('UNKNOWN consumer kind=' + kind);
  //     }
  // }

  function addConsumer(id: any, consumer: any, kind: any, mode: any) {
    if (id === clientId.current) {
      return false;
    }
    if (kind === 'video') {
      if (videoConsumers.current[id] == undefined) {
        videoConsumers.current[id] = {};
      }
      videoConsumers.current[id][mode] = consumer;
      console.log(
        'videoConsumers count=' + Object.keys(videoConsumers.current).length
      );
    } else if (kind === 'audio') {
      if (audioConsumers.current[id] == undefined) {
        audioConsumers.current[id] = {};
      }
      audioConsumers.current[id][mode] = consumer;

      console.log(
        'audioConsumers count=' + Object.keys(audioConsumers.current).length
      );
    } else {
      console.warn('UNKNOWN consumer kind=' + kind);
    }
  }

  const connectSocket: any = () => {
    if (socketRef.current == null) {
      const io: any = socketIOClient(
        config.SERVER_ENDPOINT + '/video-conference'
      );
      socketRef.current = io;
    }

    return new Promise((resolve: any, reject: any) => {
      const socket = socketRef.current;

      socket.on('connect', async function (evt: any) {
        console.log('socket.io connected(). prepare room=%s', roomName);
        await sendRequest('prepare_room', { roomId: roomName });
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
          console.log('connected to server. clientId=' + clientId.current);
          resolve();
        } else {
          console.error('UNKNOWN message from server:', message);
        }
      });
      socket.on('newProducer', function (message: any) {
        console.log('socket.io newProducer:', message);
        const remoteId = message.socketId;
        const prdId = message.producerId;
        const kind = message.kind;
        const mode = message.mode;

        if (kind === 'video') {
          console.log(
            '--try consumeAdd remoteId=' +
              remoteId +
              ', prdId=' +
              prdId +
              ', kind=' +
              kind
          );
          consumeAdd(consumerTransport.current, remoteId, prdId, kind, mode);
        } else if (kind === 'audio') {
          //console.warn('-- audio NOT SUPPORTED YET. skip remoteId=' + remoteId + ', prdId=' + prdId + ', kind=' + kind);
          console.log(
            '--try consumeAdd remoteId=' +
              remoteId +
              ', prdId=' +
              prdId +
              ', kind=' +
              kind
          );
          consumeAdd(consumerTransport.current, remoteId, prdId, kind, mode);
        }
      });

      socket.on('producerClosed', function (message: any) {
        console.log('socket.io producerClosed:', message);
        const localId = message.localId;
        const remoteId = message.remoteId;
        const kind = message.kind;
        const mode = message.mode;
        console.log(
          '--try removeConsumer remoteId=%s, localId=%s, track=%s',
          remoteId,
          localId,
          kind
        );
        removeConsumer(remoteId, kind, mode);
        removeRemoteVideo(remoteId, mode);
      });
      // socket.on('shareScreenClosed', function (payload: any) {
      //     console.log('socket.io shareScreenClosed:', payload);
      //     const callerID = payload.callerID;

      //     removeConsumer(callerID, 'video', MODE_SHARE_SCREEN);
      //     removeConsumer(callerID, 'audio', MODE_SHARE_SCREEN);
      //     removeRemoteVideoByMode(callerID, MODE_SHARE_SCREEN);
      // });
    });
  };

  // ============ MEDIA END ==========

  // ============ MEDIA CLEANUP BEFORE/AFTER START ==========
  // React.useEffect(() => {
  //   return () => {
  //     handleDisconnect();
  //   };
  // }, []);
  // ============ MEDIA CLEANUP BEFORE/AFTER END ==========

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

      {!isStartMedia ? (
        <button disabled={isStartMedia} onClick={handleStartMedia}>
          Start Media
        </button>
      ) : (
        <button
          disabled={!isStartMedia || isConnected}
          onClick={handleStopMedia}
        >
          Stop Media
        </button>
      )}
      <input
        type='text'
        disabled={isConnected}
        onChange={handleRoomName}
        value={roomName}
        placeholder='room name'
      />
      {!isConnected ? (
        <button
          disabled={isConnected || !isStartMedia || roomName.trim().length == 0}
          onClick={handleConnect}
        >
          Connect
        </button>
      ) : (
        <button
          disabled={!isConnected || !isStartMedia}
          onClick={handleDisconnect}
        >
          Disconnect
        </button>
      )}

      {isShareScreen ? (
        <button
          disabled={!isStartMedia || !isConnected}
          onClick={handleDisconnectScreenShare}
        >
          Stop Screen
        </button>
      ) : (
        <button
          disabled={!isStartMedia || !isConnected}
          onClick={handleStartScreenShare}
        >
          Start Screen
        </button>
      )}

      <div>
        <div style={{ marginTop: '20px' }}>Local Video</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div>
            <div>
              <video
                ref={localVideo}
                autoPlay
                style={{
                  width: '360px',
                  height: '240px',
                  border: '1px solid black',
                }}
              ></video>
            </div>
            {isStartMedia ? (
              <div>
                {!enableVideoStream ? (
                  <button
                    onClick={() =>
                      handleEnableVideoStream(localStream.current, true)
                    }
                  >
                    Enable Video
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleEnableVideoStream(localStream.current, false)
                    }
                  >
                    Disable Video
                  </button>
                )}
                {!enableAudioStream ? (
                  <button
                    onClick={() =>
                      handleEnableAudioStream(localStream.current, true)
                    }
                  >
                    Enable Audio
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleEnableAudioStream(localStream.current, false)
                    }
                  >
                    Disable Audio
                  </button>
                )}
              </div>
            ) : null}
          </div>
          <div style={{ display: isShareScreen ? 'block' : 'none' }}>
            <div>
              <video
                ref={localScreen}
                autoPlay
                style={{
                  width: '360px',
                  height: '240px',
                  border: '1px solid black',
                }}
              ></video>
            </div>
            {/* {isStartMedia && isShareScreen ? (
              <div>
                {!enableVideoShare ? (
                  <button
                    onClick={() =>
                      handleEnableVideoShare(localStream.current, true)
                    }
                  >
                    Enable Video
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleEnableVideoShare(localStream.current, false)
                    }
                  >
                    Disable Video
                  </button>
                )}
                {!enableAudioShare ? (
                  <button
                    onClick={() =>
                      handleEnableAudioShare(localStream.current, true)
                    }
                  >
                    Enable Audio
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleEnableAudioShare(localStream.current, false)
                    }
                  >
                    Disable Audio
                  </button>
                )}
              </div>
            ) : null} */}
          </div>
        </div>
      </div>
      <div style={{ marginTop: '20px' }}>Remote Videos</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {console.log(remoteVideos)}
        {Object.keys(remoteVideos).map((key: any, index: number) => {
          return Object.keys(remoteVideos[key]).map(
            (key2: any, index2: number) => {
              const peer: any = remoteVideos[key][key2];

              return (
                <MemoizedCreateRemoteVideos
                  mode={key2}
                  key={peer.socket_id + '__' + key2}
                  peer={peer}
                  playVideo={playVideo}
                />
              );
            }
          );
        })}
      </div>
    </div>
  );
}

export default MeetRoom;

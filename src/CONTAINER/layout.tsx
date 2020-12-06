import React, { useRef } from 'react';
import { io as socketIOClient } from 'socket.io-client';
import { isPropertySignature } from 'typescript';
import { config } from '../app.config';

function Layout(props: any) {
    React.useEffect(() => {
        const userSocket: any = socketIOClient(config.SERVER_ENDPOINT);
    }, []);
    return <div className='Layout'>{props.children}</div>;
}

export default Layout;

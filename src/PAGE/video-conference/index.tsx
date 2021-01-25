import Layout from '../../CONTAINER/layout';

import MeetRoom from './room';
import { io as socketIOClient } from 'socket.io-client';
import { config } from '../../app.config';

// const socketIO: any = socketIOClient(
//     config.SERVER_ENDPOINT + '/video-conference'
// );

function Home(props: any) {
    const view = props.match.params.view;
    return (
        <Layout>
            <MeetRoom
            //  io={socketIO}
            />
        </Layout>
    );
}

export default Home;

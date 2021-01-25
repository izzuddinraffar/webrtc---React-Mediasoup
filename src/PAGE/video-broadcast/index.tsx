import Layout from '../../CONTAINER/layout';
import Subscribe from './subscribe';
import Publish from './publish';
import { io as socketIOClient } from 'socket.io-client';
import { config } from '../../app.config';

// const userSocket: any = socketIOClient(
//     config.SERVER_ENDPOINT + '/video-broadcast'
// );

function Home(props: any) {
    const view = props.match.params.view;
    return (
        <Layout>
            {view === 'publish' ? (
                <Publish
                //  userSocket={userSocket}
                />
            ) : null}
            {view === 'subscribe' ? (
                <Subscribe
                //  userSocket={userSocket}
                />
            ) : null}
        </Layout>
    );
}

export default Home;

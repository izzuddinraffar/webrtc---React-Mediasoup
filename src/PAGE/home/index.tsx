import Layout from '../../CONTAINER/layout';
import { Link } from 'react-router-dom';

function Home() {
    return (
        <Layout>
            <div className='Home'>
                <div>
                    <h4>Video Broadcast</h4>
                    <div>
                        <Link target='_blank' to={`/broadcast/publish`}>
                            Publish
                        </Link>
                    </div>
                    <div>
                        <Link target='_blank' to={`/broadcast/subscribe`}>
                            Subscribe
                        </Link>
                    </div>
                </div>
                <div style={{ paddingTop: '20px' }}>
                    <h4>Video Conference</h4>
                    <div>
                        <Link target='_blank' to={`/conference`}>
                            Video Conference
                        </Link>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default Home;

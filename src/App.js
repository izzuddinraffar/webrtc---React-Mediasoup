import React, { Suspense } from 'react';
import logo from './logo.svg';
import { Route, Switch, Redirect } from 'react-router-dom';
import { io as socketIOClient } from 'socket.io-client';
import './App.css';

const Home = React.lazy(() => import('./PAGE/home/index'));
const Broadcast = React.lazy(() => import('./PAGE/video-broadcast/index'));
const Conference = React.lazy(() => import('./PAGE/video-conference/index'));

function App() {
    return (
        <div className='App'>
            <Switch>
                <Suspense fallback={<div>Loading...</div>}>
                    <Route path='/' exact component={Home} />
                    <Route
                        path='/broadcast/:view'
                        exact
                        component={Broadcast}
                    />
                    <Route path='/conference' exact component={Conference} />
                </Suspense>
            </Switch>
        </div>
    );
}

export default App;

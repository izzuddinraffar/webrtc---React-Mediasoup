import React, { useRef } from 'react';
import logo from './logo.svg';
import { Route, Switch, Redirect } from 'react-router-dom';
import { io as socketIOClient } from 'socket.io-client';
import Home from './PAGE/home/index';
import Broadcast from './PAGE/video-broadcast/index';
import Conference from './PAGE/video-conference/index';
import './App.css';

function App() {
    return (
        <div className='App'>
            <Switch>
                <Route path='/' exact component={Home} />
                <Route path='/broadcast/:view' exact component={Broadcast} />
                <Route path='/conference' exact component={Conference} />
            </Switch>
        </div>
    );
}

export default App;

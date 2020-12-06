import React, { useRef } from 'react';
import logo from './logo.svg';
import { Route, Switch, Redirect } from 'react-router-dom';
import { io as socketIOClient } from 'socket.io-client';
import Home from './PAGE/home/index';
import Broadcast from './PAGE/broadcast/index';
import './App.css';

function App() {
    return (
        <div className='App'>
            <Switch>
                <Route path='/' exact component={Home} />
                <Route path='/broadcast/:view' exact component={Broadcast} />
            </Switch>
        </div>
    );
}

export default App;

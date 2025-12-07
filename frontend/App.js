
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Header from './components/Header.js';
import Home from './pages/Home.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import Profile from './pages/Profile.js';
import ForgotPassword from './pages/ForgotPassword.js';
import ResetPassword from './pages/ResetPassword.js';
import Admin from './pages/Admin.js';
import Visualizer from './pages/Visualizer.js';
import Simulator from './pages/Simulator.js';
import Builder from './pages/Builder.js';
import api from './services/api.js';
import VerifyEmail from './pages/VerifyEmail.jsx';

const App = () => {
  return React.createElement(AuthProvider, null,
    React.createElement(Router, null,
      React.createElement(Header, null),
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/", element: React.createElement(Home) }),
        React.createElement(Route, { path: "/login", element: React.createElement(Login) }),
        React.createElement(Route, { path: "/register", element: React.createElement(Register) }),
        React.createElement(Route, { path: "/profile", element: React.createElement(Profile) }),
        React.createElement(Route, { path: "/forgot-password", element: React.createElement(ForgotPassword) }),
        React.createElement(Route, { path: "/reset-password", element: React.createElement(ResetPassword) }),
        React.createElement(Route, { path: "/verify-email", element: React.createElement(VerifyEmail) }),
        React.createElement(Route, { path: "/admin", element: React.createElement(Admin) }),
        React.createElement(Route, { path: "/visualizer", element: React.createElement(Visualizer) }),
        React.createElement(Route, { path: "/simulator", element: React.createElement(Simulator) }),
        React.createElement(Route, { path: "/builder", element: React.createElement(Builder) }),
        React.createElement(Route, { path: "*", element: React.createElement(Navigate, { to: "/" }) })
      )
    )
  );
};

export default App;

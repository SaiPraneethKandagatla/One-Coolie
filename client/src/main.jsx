import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.jsx';

import './index.css';

import { io } from 'socket.io-client';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import ToastProvider from './components/Toast';

const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : (import.meta.env.DEV ? 'http://localhost:5000' : 'https://onecoolie.onrender.com'));

window.socket = io(socketUrl, {
  transports: ['websocket', 'polling'],
});

ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider />
          <App />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
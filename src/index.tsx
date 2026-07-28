import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { VoiceProvider } from './context/VoiceContext';
import { ToastProvider } from './context/ToastContext';
import AppShell from './components/AppShell';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <VoiceProvider>
          <AppShell />
        </VoiceProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
);

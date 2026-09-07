import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthGate, AuthProvider } from './auth';
import { StoreProvider } from './store';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate>
        <StoreProvider>
          <App />
        </StoreProvider>
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>,
);

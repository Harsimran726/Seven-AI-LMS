import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress internal AbortError / signal aborted errors from Firestore SDK listener cleanups
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || String(reason || '');
  const name = reason?.name || '';
  if (
    name === 'AbortError' ||
    msg.includes('signal is aborted') ||
    msg.includes('aborted without reason') ||
    msg.includes('AbortError') ||
    msg.includes('cancelled') ||
    msg.includes('canceled')
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  const errorName = event.error?.name || '';
  if (
    errorName === 'AbortError' ||
    msg.includes('signal is aborted') ||
    msg.includes('aborted without reason') ||
    msg.includes('AbortError') ||
    msg.includes('cancelled') ||
    msg.includes('canceled')
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


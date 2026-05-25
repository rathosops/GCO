import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ToastProvider } from '@/components/feedback/toast';
import { useAuthStore } from '@/store/auth';

function Bootstrap() {
  // garante que token/user do localStorage reflitam no zustand
  const hydrate = useAuthStore((s) => s.hydrateFromStorage);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <Bootstrap />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);

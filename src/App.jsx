import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DispatchProvider } from './context/DispatchContext';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/ui/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DispatchProvider>
          <AppRoutes />
        </DispatchProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

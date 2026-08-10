import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { useUserStore } from '#entities/user';
import { BondCalculatorPage } from '#pages/BondCalculatorPage';
import { PortfolioPage } from '#pages/PortfolioPage';

import { useTheme } from './useTheme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: { retry: false },
  },
});

export function App() {
  const theme = useTheme();
  const status = useUserStore((state) => state.status);
  const initialize = useUserStore((state) => state.initialize);

  useEffect(() => { void initialize(); }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BondCalculatorPage {...theme} />} />
          <Route
            path="/portfolio"
            element={status === 'checking'
              ? <div aria-label="Проверка авторизации" />
              : status === 'authenticated'
                ? <PortfolioPage {...theme} />
                : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

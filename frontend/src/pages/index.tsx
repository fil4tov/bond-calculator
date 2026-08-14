import { useEffect } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';

import { useUserStore } from '#entities/user';

import { BondCalculatorPage } from './BondCalculatorPage';
import { PortfolioPage } from './PortfolioPage';

interface PagesProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function Pages({ theme, toggleTheme }: PagesProps) {
  const status = useUserStore((state) => state.status);
  const initialize = useUserStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return useRoutes([
    {
      path: '/',
      element: <BondCalculatorPage theme={theme} toggleTheme={toggleTheme} />,
    },
    {
      path: '/portfolio',
      element: status === 'checking'
        ? <div aria-label="Проверка авторизации" />
        : status === 'authenticated'
          ? <PortfolioPage theme={theme} toggleTheme={toggleTheme} />
          : <Navigate to="/" replace />,
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ]);
}

export { BondCalculatorPage } from './BondCalculatorPage';
export { PortfolioPage } from './PortfolioPage';

import { BondCalculatorPage } from '#pages/BondCalculatorPage';

import { useTheme } from './useTheme';

export function App() {
  const theme = useTheme();
  return <BondCalculatorPage {...theme} />;
}

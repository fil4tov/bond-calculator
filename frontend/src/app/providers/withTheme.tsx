import type { ComponentType } from 'react';

import { useTheme } from '../useTheme';

export type ThemeInjectedProps = ReturnType<typeof useTheme>;

export function withTheme(Component: ComponentType<ThemeInjectedProps>) {
  return function WithTheme() {
    return <Component {...useTheme()} />;
  };
}

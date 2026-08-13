import type { ComponentType } from 'react';

import { withQueryProvider } from './withQueryProvider';
import { withRouter } from './withRouter';
import { withTheme } from './withTheme';
import type { ThemeInjectedProps } from './withTheme';

export function withProviders(Component: ComponentType<ThemeInjectedProps>) {
  const ThemedComponent = withTheme(Component);

  return [withRouter, withQueryProvider].reduceRight(
    (Target, wrap) => wrap(Target),
    ThemedComponent,
  );
}

import type { ComponentType } from 'react';
import { BrowserRouter } from 'react-router-dom';

export function withRouter(Component: ComponentType) {
  return function WithRouter() {
    return (
      <BrowserRouter>
        <Component />
      </BrowserRouter>
    );
  };
}

import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfigFromFile } from 'vite';

describe('Vite API proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('routes an E2E run to its isolated backend instead of the development backend', async () => {
    vi.stubEnv('VITE_API_PROXY_TARGET', 'http://127.0.0.1:8001');
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'test' },
      path.resolve('vite.config.ts'),
      process.cwd(),
    );
    if (!loaded) throw new Error('Vite config was not loaded');

    expect(loaded.config.server?.proxy?.['/api']).toBe('http://127.0.0.1:8001');
  });
});

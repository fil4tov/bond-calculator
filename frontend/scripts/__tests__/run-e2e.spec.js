import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runE2E } from '../run-e2e.mjs';

describe('E2E stack runner', () => {
  it('uses the isolated Compose project and tears it down after a Playwright failure', async () => {
    const calls = [];
    const playwrightFailure = new Error('Playwright failed');
    const execute = async (command, args, options) => {
      calls.push({ command, args, options });
      if (args.some((argument) => /@playwright[\\/]test[\\/]cli\.js$/.test(argument))) {
        throw playwrightFailure;
      }
    };

    await expect(runE2E({ execute, playwrightArgs: ['--project=desktop'] }))
      .rejects.toBe(playwrightFailure);

    expect(calls).toHaveLength(3);
    expect(calls[0].args).toEqual([
      'compose', '--project-name', 'bonds-e2e', '-f', expect.stringMatching(/compose\.e2e\.yaml$/),
      'up', '--build', '--wait',
    ]);
    expect(path.basename(calls[1].command)).toMatch(/^node(?:\.exe)?$/);
    expect(calls[1].args).toEqual([
      expect.stringMatching(/@playwright[\\/]test[\\/]cli\.js$/), 'test', '--project=desktop',
    ]);
    expect(calls[1].options.env.VITE_API_PROXY_TARGET).toBe('http://127.0.0.1:8001');
    expect(calls[2].args).toEqual([
      'compose', '--project-name', 'bonds-e2e', '-f', expect.stringMatching(/compose\.e2e\.yaml$/),
      'down', '--volumes', '--remove-orphans',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

describe('pages public API', () => {
  it('exports the root Pages component', async () => {
    const pages = await import('#pages');

    expect(pages).toHaveProperty('Pages');
  });
});

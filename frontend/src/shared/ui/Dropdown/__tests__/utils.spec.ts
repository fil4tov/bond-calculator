import { describe, expect, it } from 'vitest';

import { getDropdownPlacement } from '../utils';

describe('getDropdownPlacement', () => {
  it('opens below when the content fits', () => {
    expect(getDropdownPlacement({
      contentHeight: 160,
      gap: 12,
      triggerTop: 200,
      triggerBottom: 240,
      viewportTop: 0,
      viewportBottom: 600,
    })).toBe('bottom');
  });

  it('opens above when there is not enough space below', () => {
    expect(getDropdownPlacement({
      contentHeight: 160,
      gap: 12,
      triggerTop: 500,
      triggerBottom: 540,
      viewportTop: 0,
      viewportBottom: 600,
    })).toBe('top');
  });

  it('uses the side with more space when neither side fully fits', () => {
    expect(getDropdownPlacement({
      contentHeight: 500,
      gap: 12,
      triggerTop: 350,
      triggerBottom: 390,
      viewportTop: 0,
      viewportBottom: 600,
    })).toBe('top');
  });
});

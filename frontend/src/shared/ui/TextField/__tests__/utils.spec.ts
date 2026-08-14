import { describe, expect, it } from 'vitest';

import { getValueAfterInsertion } from '../utils';

describe('getValueAfterInsertion', () => {
  it('replaces the selected range', () => {
    const input = document.createElement('input');
    input.value = '1234';
    input.setSelectionRange(1, 3);

    expect(getValueAfterInsertion(input, '9')).toBe('194');
  });

  it('appends when the input does not expose selection offsets', () => {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '12';

    expect(input.selectionStart).toBeNull();
    expect(getValueAfterInsertion(input, '3')).toBe('123');
  });
});

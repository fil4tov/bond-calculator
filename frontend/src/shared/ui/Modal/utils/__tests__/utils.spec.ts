import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  focusableElements,
  mountModal,
  topmostModal,
  unmountModal,
} from '..';
import type { ModalStackEntry } from '..';

const mountedEntries: ModalStackEntry[] = [];

function createEntry(previousFocus: HTMLElement | null = null) {
  const dialog = document.createElement('div');
  const closeButton = document.createElement('button');
  dialog.append(closeButton);
  document.body.append(dialog);
  const entry: ModalStackEntry = {
    dialog,
    closeButton,
    previousFocus,
    handleKeyDown: vi.fn(),
  };
  mountedEntries.push(entry);
  return entry;
}

afterEach(() => {
  while (mountedEntries.length > 0) {
    const entry = mountedEntries.pop();
    if (entry) {
      unmountModal(entry);
      entry.dialog.remove();
    }
  }
  document.body.style.overflow = '';
  document.body.replaceChildren();
});

describe('Modal utils', () => {
  it('returns only visible keyboard-focusable elements', () => {
    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <button data-testid="visible">Visible</button>
      <button disabled>Disabled</button>
      <input type="hidden" />
      <a href="#" tabindex="-1">Negative</a>
      <div hidden><button>Hidden ancestor</button></div>
      <input style="display: none" />
    `;
    document.body.append(dialog);

    expect(focusableElements(dialog).map((element) => element.dataset.testid)).toEqual(['visible']);
  });

  it('routes document keydown to the top entry and restores scroll and focus', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    document.body.style.overflow = 'auto';
    const lower = createEntry(trigger);
    const upper = createEntry(lower.closeButton);

    mountModal(lower);
    mountModal(upper);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(topmostModal()).toBe(upper);
    expect(upper.handleKeyDown).toHaveBeenCalledOnce();
    expect(lower.handleKeyDown).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('hidden');

    unmountModal(upper);
    mountedEntries.splice(mountedEntries.indexOf(upper), 1);
    expect(lower.closeButton).toHaveFocus();

    unmountModal(lower);
    mountedEntries.splice(mountedEntries.indexOf(lower), 1);
    expect(document.body.style.overflow).toBe('auto');
    expect(trigger).toHaveFocus();
  });
});

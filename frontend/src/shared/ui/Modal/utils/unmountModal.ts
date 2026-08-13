import { handleDocumentKeyDown } from './handleDocumentKeyDown';
import { modalStackState } from './modalStackState';
import { topmostModal } from './topmostModal';
import type { ModalStackEntry } from './types';

export function unmountModal(entry: ModalStackEntry) {
  const index = modalStackState.entries.indexOf(entry);
  if (index < 0) return;
  const wasTopmost = index === modalStackState.entries.length - 1;
  modalStackState.entries.splice(index, 1);

  if (modalStackState.entries.length === 0) {
    document.removeEventListener('keydown', handleDocumentKeyDown);
    document.body.style.overflow = modalStackState.overflowBeforeModals ?? '';
    const focusTarget = entry.previousFocus?.isConnected ? entry.previousFocus : modalStackState.returnFocus;
    modalStackState.overflowBeforeModals = null;
    modalStackState.returnFocus = null;
    focusTarget?.focus();
    return;
  }

  document.body.style.overflow = 'hidden';
  if (!wasTopmost) return;

  const nextTopmost = topmostModal();
  if (!nextTopmost) return;
  const focusTarget = entry.previousFocus;
  if (focusTarget?.isConnected && nextTopmost.dialog.contains(focusTarget)) {
    focusTarget.focus();
  } else {
    nextTopmost.closeButton?.focus();
  }
}

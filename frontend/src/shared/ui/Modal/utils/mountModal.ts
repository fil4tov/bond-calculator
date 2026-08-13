import { handleDocumentKeyDown } from './handleDocumentKeyDown';
import { modalStackState } from './modalStackState';
import type { ModalStackEntry } from './types';

export function mountModal(entry: ModalStackEntry) {
  if (modalStackState.entries.length === 0) {
    modalStackState.overflowBeforeModals = document.body.style.overflow;
    modalStackState.returnFocus = entry.previousFocus;
    document.addEventListener('keydown', handleDocumentKeyDown);
  }
  modalStackState.entries.push(entry);
  document.body.style.overflow = 'hidden';
}

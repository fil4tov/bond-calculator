import type { ModalStackEntry } from './types';

interface ModalStackState {
  entries: ModalStackEntry[];
  overflowBeforeModals: string | null;
  returnFocus: HTMLElement | null;
}

export const modalStackState: ModalStackState = {
  entries: [],
  overflowBeforeModals: null,
  returnFocus: null,
};

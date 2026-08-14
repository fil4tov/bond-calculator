export interface ModalStackEntry {
  dialog: HTMLDivElement;
  closeButton: HTMLButtonElement | null;
  previousFocus: HTMLElement | null;
  handleKeyDown: (event: KeyboardEvent) => void;
}

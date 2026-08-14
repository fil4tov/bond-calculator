import { topmostModal } from './topmostModal';

export function handleDocumentKeyDown(event: KeyboardEvent) {
  topmostModal()?.handleKeyDown(event);
}

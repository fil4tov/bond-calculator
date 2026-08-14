import { modalStackState } from './modalStackState';

export function topmostModal() {
  return modalStackState.entries.at(-1);
}

import { toLocalDateInputValue } from './toLocalDateInputValue';

export function getDefaultMaturityDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setFullYear(date.getFullYear() + 5);
  return toLocalDateInputValue(date);
}

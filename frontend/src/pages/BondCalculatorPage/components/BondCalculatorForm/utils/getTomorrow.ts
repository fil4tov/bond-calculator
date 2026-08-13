import { toLocalDateInputValue } from './toLocalDateInputValue';

export function getTomorrow() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return toLocalDateInputValue(date);
}

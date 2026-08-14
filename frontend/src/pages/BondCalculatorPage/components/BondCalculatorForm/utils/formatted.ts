import { formatInputNumber } from '#shared/lib/number';

export function formatted(value: number, integer = false) {
  return formatInputNumber(value, integer);
}

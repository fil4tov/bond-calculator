import { toKopecks } from './toKopecks';

export function sumMoney(values: string[]) {
  return values.reduce((total, value) => total + toKopecks(value), 0n);
}

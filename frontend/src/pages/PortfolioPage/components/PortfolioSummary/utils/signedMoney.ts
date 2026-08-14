import { formatMoney } from '../../../utils';

export function signedMoney(value: string) {
  if (value.startsWith('-') || /^0(?:\.0+)?$/.test(value)) return formatMoney(value);
  return `+${formatMoney(value)}`;
}

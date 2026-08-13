import { formatMoney } from '../../../utils';

import { resultSign } from './resultSign';

export function formatOperationResult(value: string) {
  return `${resultSign(value) === 'positive' ? '+' : ''}${formatMoney(value)}`;
}

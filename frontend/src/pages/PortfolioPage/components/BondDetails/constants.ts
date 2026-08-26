import type { BondDetailsSection } from './types';

export const BOND_DETAILS_SECTIONS: Array<{
  id: BondDetailsSection;
  label: string;
}> = [
  { id: 'position', label: 'Моя позиция' },
  { id: 'coupons', label: 'Купоны' },
  { id: 'issue', label: 'Об облигации' },
  { id: 'operations', label: 'Операции' },
];

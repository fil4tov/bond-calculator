import type { BondPortfolioItem } from '#entities/bondPortfolio';

export type OpenPortfolioModal =
  | { kind: 'create' }
  | { kind: 'details'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement; focusOperationId?: string }
  | { kind: 'purchase'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement }
  | { kind: 'sale'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement }
  | { kind: 'confirm-bond'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement }
  | null;

export interface PortfolioModalProps {
  modal: OpenPortfolioModal;
  onClose: () => void;
}

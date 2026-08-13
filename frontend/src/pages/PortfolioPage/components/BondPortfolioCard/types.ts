import type { BondPortfolioItem } from '#entities/bondPortfolio';

export interface BondPortfolioCardProps {
  bond: BondPortfolioItem;
  onOpenDetails: (returnFocusTarget: HTMLElement) => void;
  onAddPurchase: (returnFocusTarget: HTMLElement) => void;
  onAddSale: (returnFocusTarget: HTMLElement) => void;
  onDelete: (returnFocusTarget: HTMLElement) => void;
  deleteDisabled?: boolean;
}

export type BondActionHandler = (returnFocusTarget: HTMLElement) => void;

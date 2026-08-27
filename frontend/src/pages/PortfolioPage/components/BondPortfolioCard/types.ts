import type { BondPortfolioItem } from '#entities/bondPortfolio';

export interface BondPortfolioCardProps {
  bond: BondPortfolioItem;
  onOpenDetails: (returnFocusTarget: HTMLElement) => void;
}

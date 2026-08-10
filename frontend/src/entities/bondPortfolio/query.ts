import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addBondPurchase, checkBondNameAvailability, createBond, deletePortfolioBond, getPortfolioBonds } from './api';
import type { AddBondPurchaseInput, BondPortfolioItem, CreateBondInput } from './types';

export const portfolioQueryKey = (userId: string) => ['bondPortfolio', userId, 'bonds'] as const;
const nameAvailabilityQueryKey = (userId: string, name: string) => ['bondPortfolio', userId, 'nameAvailability', name] as const;

export function replacePortfolioBond<T extends { id: string }>(items: T[] | undefined, updated: T) {
  if (!items) return [updated];
  return items.map((item) => item.id === updated.id ? updated : item);
}

const comparePortfolioBonds = (left: BondPortfolioItem, right: BondPortfolioItem) => {
  if (left.status !== right.status) return left.status === 'active' ? -1 : 1;
  const maturityOrder = left.maturityDate.localeCompare(right.maturityDate);
  return maturityOrder || left.name.localeCompare(right.name, 'ru-RU');
};

const upsertPortfolioBond = (items: BondPortfolioItem[] | undefined, updated: BondPortfolioItem) => {
  const hasItem = items?.some((item) => item.id === updated.id) ?? false;
  const next = hasItem ? replacePortfolioBond(items, updated) : [...(items ?? []), updated];
  return next.sort(comparePortfolioBonds);
};

export function usePortfolioBonds(userId: string) {
  return useQuery({
    queryKey: portfolioQueryKey(userId),
    queryFn: ({ signal }) => getPortfolioBonds(signal),
    enabled: Boolean(userId),
  });
}

export function useBondNameAvailability(userId: string, name: string, enabled: boolean) {
  return useQuery({
    queryKey: nameAvailabilityQueryKey(userId, name),
    queryFn: ({ signal }) => checkBondNameAvailability(name, signal),
    enabled: Boolean(userId) && enabled,
    retry: false,
  });
}

export function useCreatePortfolioBond(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBondInput) => createBond(input),
    onSuccess: (bond) => {
      queryClient.setQueryData<BondPortfolioItem[]>(portfolioQueryKey(userId), (items) => upsertPortfolioBond(items, bond));
    },
  });
}

export function useAddPortfolioPurchase(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bondId, input }: { bondId: string; input: AddBondPurchaseInput }) => addBondPurchase(bondId, input),
    onSuccess: (bond) => {
      queryClient.setQueryData<BondPortfolioItem[]>(portfolioQueryKey(userId), (items) => upsertPortfolioBond(items, bond));
    },
  });
}

export function useDeletePortfolioBond(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bondId: string) => deletePortfolioBond(bondId),
    onSuccess: (_data, bondId) => {
      queryClient.setQueryData<BondPortfolioItem[]>(portfolioQueryKey(userId), (items) => (
        items?.filter((item) => item.id !== bondId)
      ));
    },
  });
}

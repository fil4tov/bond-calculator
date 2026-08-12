import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addBondPurchase, addBondSale, checkBondNameAvailability, createBond, deletePortfolioBond, deletePortfolioOperation, getPortfolioBonds, lookupTInvestBond, searchTInvestBonds } from './api';
import type { AddBondPurchaseInput, AddBondSaleInput, BondPortfolioItem, CreateBondInput } from './types';

export const portfolioQueryKey = (userId: string) => ['bondPortfolio', userId, 'bonds'] as const;
const nameAvailabilityQueryKey = (userId: string, name: string) => ['bondPortfolio', userId, 'nameAvailability', name] as const;
export const tInvestSearchQueryKey = (userId: string, query: string) => ['bondPortfolio', userId, 'tInvestSearch', query] as const;
export const tInvestLookupQueryKey = (userId: string, instrumentUid: string) => ['bondPortfolio', userId, 'tInvestLookup', instrumentUid] as const;

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

const refreshPortfolioBonds = (queryClient: ReturnType<typeof useQueryClient>, userId: string) => {
  void queryClient.invalidateQueries({
    queryKey: portfolioQueryKey(userId),
    refetchType: 'active',
  });
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

export function useTInvestBondSearch(userId: string, query: string, enabled: boolean) {
  return useQuery({
    queryKey: tInvestSearchQueryKey(userId, query),
    queryFn: ({ signal }) => searchTInvestBonds(query, signal),
    enabled: Boolean(userId) && enabled,
    retry: false,
  });
}

export function useTInvestBondLookup(userId: string, instrumentUid: string, enabled: boolean) {
  return useQuery({
    queryKey: tInvestLookupQueryKey(userId, instrumentUid),
    queryFn: ({ signal }) => lookupTInvestBond(instrumentUid, signal),
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
      refreshPortfolioBonds(queryClient, userId);
    },
  });
}

export function useAddPortfolioPurchase(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bondId, input }: { bondId: string; input: AddBondPurchaseInput }) => addBondPurchase(bondId, input),
    onSuccess: (bond) => {
      queryClient.setQueryData<BondPortfolioItem[]>(portfolioQueryKey(userId), (items) => upsertPortfolioBond(items, bond));
      refreshPortfolioBonds(queryClient, userId);
    },
  });
}

export function useAddPortfolioSale(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bondId, input }: { bondId: string; input: AddBondSaleInput }) => addBondSale(bondId, input),
    onSuccess: (bond) => {
      queryClient.setQueryData<BondPortfolioItem[]>(portfolioQueryKey(userId), (items) => upsertPortfolioBond(items, bond));
      refreshPortfolioBonds(queryClient, userId);
    },
  });
}

export function useDeletePortfolioOperation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bondId, operationId }: { bondId: string; operationId: string }) => deletePortfolioOperation(bondId, operationId),
    onSuccess: (bond, { bondId }) => {
      queryClient.setQueryData<BondPortfolioItem[]>(portfolioQueryKey(userId), (items) => {
        if (!bond) return items?.filter((item) => item.id !== bondId);
        return upsertPortfolioBond(items, bond);
      });
      refreshPortfolioBonds(queryClient, userId);
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
      refreshPortfolioBonds(queryClient, userId);
    },
  });
}

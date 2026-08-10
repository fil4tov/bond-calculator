import type { PurchaseMode, SavedBondCalculation } from './types';

export const THEME_STORAGE_KEY = 'bond-theme';
export const PURCHASE_MODE_STORAGE_KEY = 'bond-purchase-mode';
export const PRESETS_STORAGE_KEY = 'bond-calculation-presets';
export const PRESETS_STORAGE_VERSION = 1;

const collator = new Intl.Collator('ru', { sensitivity: 'base' });

export const normalizePresetName = (name: unknown) => typeof name === 'string'
  ? name.trim().toLocaleLowerCase('ru-RU')
  : '';

export const sortPresets = (items: SavedBondCalculation[]) => [...items].sort((first, second) =>
  collator.compare(first.name, second.name) || first.name.localeCompare(second.name, 'ru'));

export function upsertPreset(items: SavedBondCalculation[], preset: SavedBondCalculation) {
  const name = preset.name.trim();
  const normalizedName = normalizePresetName(name);
  const existing = items.find((item) => normalizePresetName(item.name) === normalizedName);
  const next = { ...preset, id: existing?.id ?? preset.id, name, normalizedName };
  return sortPresets([...items.filter((item) => normalizePresetName(item.name) !== normalizedName), next]);
}

export function deserializePresetStore(serialized: string | null): SavedBondCalculation[] {
  if (!serialized) return [];
  try {
    const store = JSON.parse(serialized) as { version?: number; items?: unknown };
    if (store.version !== PRESETS_STORAGE_VERSION || !Array.isArray(store.items)) return [];
    return sortPresets(store.items.filter((item): item is SavedBondCalculation => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<SavedBondCalculation>;
      return typeof candidate.id === 'string' && typeof candidate.name === 'string'
        && candidate.name.trim() !== '' && Boolean(candidate.fields) && typeof candidate.fields === 'object';
    }).map((item) => {
      const name = item.name.trim().slice(0, 80);
      return { ...item, name, normalizedName: normalizePresetName(name) };
    }));
  } catch {
    return [];
  }
}

export function readPresets(storage: Storage | undefined = globalThis.localStorage) {
  try { return deserializePresetStore(storage?.getItem(PRESETS_STORAGE_KEY) ?? null); } catch { return []; }
}

export function writePresets(items: SavedBondCalculation[], storage: Storage | undefined = globalThis.localStorage) {
  try {
    storage?.setItem(PRESETS_STORAGE_KEY, JSON.stringify({ version: PRESETS_STORAGE_VERSION, items }));
    return Boolean(storage);
  } catch { return false; }
}

export function readPurchaseMode(storage: Storage | undefined = globalThis.localStorage): PurchaseMode {
  try { return storage?.getItem(PURCHASE_MODE_STORAGE_KEY) === 'amount' ? 'amount' : 'quantity'; }
  catch { return 'quantity'; }
}

export function writePurchaseMode(mode: PurchaseMode, storage: Storage | undefined = globalThis.localStorage) {
  try { storage?.setItem(PURCHASE_MODE_STORAGE_KEY, mode); } catch { /* Local state remains active. */ }
}

export function createPresetId() {
  return globalThis.crypto?.randomUUID?.() ?? `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

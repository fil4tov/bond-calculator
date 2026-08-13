import { useEffect, useRef, useState } from 'react';
import { FiSave } from 'react-icons/fi';

import {
  createPresetId,
  normalizePresetName,
  readPresets,
  sortPresets,
  upsertPreset,
  writePresets,
} from '#entities/bondCalculation';
import type { BondCalculationResult, HoldingMode, SavedBondCalculation } from '#entities/bondCalculation';
import { parseFormattedNumber } from '#shared/lib/number';
import { Button, Typography } from '#shared/ui';
import { SiteHeader } from '#widgets/SiteHeader';

import { BondCalculatorForm } from './components/BondCalculatorForm';
import type { BondCalculatorFormHandle } from './components/BondCalculatorForm';
import { PresetsMenu } from './components/PresetsMenu';
import { ResultsPanel } from './components/ResultsPanel';
import styles from './BondCalculatorPage.module.scss';
import type { BondCalculatorFormValues } from './types';

interface BondCalculatorPageProps { theme: 'light' | 'dark'; toggleTheme: () => void }

function collectPreset(formValues: BondCalculatorFormValues): SavedBondCalculation {
  const name = formValues.bondName.trim();
  return {
    id: createPresetId(),
    name,
    normalizedName: normalizePresetName(name),
    updatedAt: new Date().toISOString(),
    fields: {
      nominal: parseFormattedNumber(formValues.nominal),
      purchasePrice: parseFormattedNumber(formValues.purchasePrice),
      coupon: parseFormattedNumber(formValues.coupon),
      paymentsPerYear: parseFormattedNumber(formValues.paymentsPerYear),
      purchaseMode: formValues.purchaseMode,
      quantity: parseFormattedNumber(formValues.quantity),
      investmentAmount: parseFormattedNumber(formValues.investmentAmount),
      holdToMaturity: formValues.holdToMaturity,
      maturityDate: formValues.maturityDate,
      holdingYears: parseFormattedNumber(formValues.holdingYears),
      holdingMonths: parseFormattedNumber(formValues.holdingMonths),
      salePrice: parseFormattedNumber(formValues.salePrice),
    },
  };
}

export function BondCalculatorPage({ theme, toggleTheme }: BondCalculatorPageProps) {
  const formRef = useRef<BondCalculatorFormHandle>(null);
  const [result, setResult] = useState<BondCalculationResult | null>(null);
  const [holdingMode, setHoldingMode] = useState<HoldingMode>('yes');
  const [presets, setPresets] = useState<SavedBondCalculation[]>(() => readPresets());
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const handleSave = () => {
    const formValues = formRef.current?.prepareSave();
    if (!formValues) return;

    const name = formValues.bondName.trim();
    const existing = presets.find((preset) => preset.normalizedName === normalizePresetName(name));
    if (existing && !window.confirm(`Пресет «${existing.name}» уже существует. Сохранение перезапишет его. Продолжить?`)) return;

    const preset = collectPreset(formValues);
    if (existing) preset.id = existing.id;
    const next = upsertPreset(presets, preset);
    if (!writePresets(next)) {
      window.alert('Не удалось сохранить расчёт. Проверьте, доступно ли локальное хранилище браузера.');
      return;
    }

    setPresets(next);
    formRef.current?.setBondName(name);
    setSaveFeedback(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaveFeedback(false), 1800);
  };

  const handleDeletePreset = (preset: SavedBondCalculation) => {
    if (!window.confirm(`Удалить сохранённый расчёт «${preset.name}»?`)) return;
    const next = presets.filter((item) => item.id !== preset.id);
    if (!writePresets(next)) {
      window.alert('Не удалось удалить расчёт. Проверьте, доступно ли локальное хранилище браузера.');
      return;
    }
    setPresets(next);
  };

  const handleRestorePreset = (preset: SavedBondCalculation) => {
    formRef.current?.restorePreset(preset);
    setPresetsOpen(false);
  };

  return (
    <main className={styles.pageShell}>
      <header className={styles.hero}>
        <SiteHeader
          theme={theme}
          toggleTheme={toggleTheme}
          additionalAction={
            <PresetsMenu presets={sortPresets(presets)} open={presetsOpen} onOpenChange={setPresetsOpen} onRestore={handleRestorePreset} onDelete={handleDeletePreset} />
          }
        />
        <Typography as="h1" variant="display">Рассчитайте реальную<br />доходность вложения</Typography>
        <Typography>Учтём купоны, срок владения и разницу между ценой покупки и ценой выхода.</Typography>
      </header>

      <section className={styles.calculator} aria-label="Калькулятор доходности облигации">
        <BondCalculatorForm
          ref={formRef}
          onResultChange={setResult}
          onHoldingModeChange={setHoldingMode}
          onClear={() => setPresetsOpen(false)}
        />
        <ResultsPanel
          result={result}
          holdingMode={holdingMode}
          action={result ? <div className={styles.saveAction}><Button type="button" variant="secondary" trailingIcon={<FiSave />} onClick={handleSave}>{saveFeedback ? 'Расчёт сохранён' : 'Сохранить расчёт'}</Button><span className={styles.visuallyHidden} aria-live="polite">{saveFeedback ? 'Расчёт сохранён' : ''}</span></div> : null}
        />
      </section>
    </main>
  );
}

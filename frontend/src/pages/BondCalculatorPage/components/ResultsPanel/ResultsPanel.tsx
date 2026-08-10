import type { ReactNode } from 'react';

import { formatHoldingPeriod, formatPaymentFrequency } from '#entities/bondCalculation';
import type { BondCalculationResult, HoldingMode } from '#entities/bondCalculation';
import { BarChartIcon, Tooltip, Typography } from '#shared/ui';

import styles from '../../BondCalculatorPage.module.scss';

interface ResultsPanelProps { result: BondCalculationResult | null; holdingMode: HoldingMode; action?: ReactNode }

const currencyFormatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantityFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

function SignedValue({ value }: { value: number }) {
  return <dd className={value > 0 ? styles.positive : value < 0 ? styles.negative : ''}>{currencyFormatter.format(value)}</dd>;
}

export function ResultsPanel({ result, holdingMode, action }: ResultsPanelProps) {
  return (
    <aside className={styles.resultsPanel} aria-labelledby="results-title">
      <div className={styles.resultsTopline}>
        <div className={styles.resultsHeading}><span className={`${styles.stepNumber} ${styles.stepLight}`}>2</span><h2 id="results-title">Итог</h2></div>
        <span className={styles.scenarioLabel}>{holdingMode === 'yes' ? 'До погашения' : 'Продажа'}</span>
      </div>
      {!result ? (
        <div className={styles.emptyResults}>
          <BarChartIcon />
          <Typography as="h2" variant="title">Ваш результат</Typography>
          <p>Заполните параметры — здесь появится прогноз доходности</p>
        </div>
      ) : (
        <div className={styles.calculatedResults}>
          <div className={styles.resultKicker}>Годовая доходность</div>
          <div className={styles.yieldComparison}>
            <div className={styles.yieldMetric}>
              <div className={styles.yieldLabel}><span>Купонная</span><Tooltip label="Формула купонной доходности">Купон × выплат в год ÷ цена покупки</Tooltip></div>
              <strong>{percentFormatter.format(result.annualYield)}%</strong>
            </div>
            <div className={`${styles.yieldMetric} ${result.annualYieldWithPrice < 0 ? styles.loss : ''}`}>
              <div className={styles.yieldLabel}><span>С учётом суммы погашения</span><Tooltip align="right" label="Формула доходности с учётом суммы погашения">Весь доход и изменение цены ÷ срок владения ÷ вложение</Tooltip></div>
              <strong>{percentFormatter.format(result.annualYieldWithPrice)}%</strong>
            </div>
          </div>
          <dl className={styles.summaryCard}>
            <div><dt>Доход в год</dt><SignedValue value={result.annualIncome} /></div>
            <div><dt>Выплата <small>{formatPaymentFrequency(result.paymentsPerYear)}</small></dt><dd>{currencyFormatter.format(result.paymentAmount)}</dd></div>
            <div><dt>Доход с процентов за весь срок</dt><SignedValue value={result.couponIncomeTotal} /></div>
            <div><dt><span>Доход/убыток от цены при выходе <Tooltip align="right" label="Пояснение к доходу или убытку от цены при выходе">Разница между ценой выхода и ценой покупки, умноженная на количество бумаг</Tooltip></span></dt><SignedValue value={result.priceDifference} /></div>
            <div><dt>Общий доход</dt><SignedValue value={result.totalProfit} /></div>
          </dl>
          <div className={styles.detailsCard}>
            <dl>
              <div><dt>Срок владения</dt><dd>{formatHoldingPeriod(result.holdingYears)}</dd></div>
              <div><dt>Количество облигаций</dt><dd>{quantityFormatter.format(result.quantity)} шт.</dd></div>
              <div><dt>Сумма вложения</dt><dd>{currencyFormatter.format(result.investment)}</dd></div>
              <div><dt>Итоговая сумма</dt><dd>{currencyFormatter.format(result.finalAmount)}</dd></div>
            </dl>
          </div>
          <p className={styles.calculationNote}>Расчёт ориентировочный: без налогов и реинвестирования купонов.</p>
        </div>
      )}
      {action}
    </aside>
  );
}

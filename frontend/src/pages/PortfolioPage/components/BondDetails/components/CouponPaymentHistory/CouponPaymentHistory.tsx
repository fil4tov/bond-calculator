import { useId, useMemo, useState } from 'react';
import { FiCalendar, FiChevronDown } from 'react-icons/fi';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatDate, formatMoney } from '../../../../utils';
import styles from './CouponPaymentHistory.module.scss';
import { groupCouponPaymentsByYear } from './utils';

function paymentCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return `${count} выплат`;
  if (last === 1) return `${count} выплата`;
  if (last >= 2 && last <= 4) return `${count} выплаты`;
  return `${count} выплат`;
}

function yearCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return `${count} лет`;
  if (last === 1) return `${count} год`;
  if (last >= 2 && last <= 4) return `${count} года`;
  return `${count} лет`;
}

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function CouponPaymentHistory({ bond }: { bond: BondPortfolioItem }) {
  const panelId = useId();
  const yearGroups = useMemo(
    () => groupCouponPaymentsByYear(bond.couponPayments),
    [bond.couponPayments],
  );
  const latestYear = yearGroups[0]?.year;
  const latestPayment = yearGroups[0]?.payments[0];
  const [expanded, setExpanded] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(
    () => new Set(latestYear === undefined ? [] : [latestYear]),
  );

  const toggleYear = (year: number) => {
    setExpandedYears((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  if (!latestPayment) {
    return (
      <section className={`${styles.history} ${styles.empty}`} aria-label="История купонных выплат">
        <span className={styles.icon} aria-hidden="true"><FiCalendar /></span>
        <span className={styles.summaryCopy}>
          <strong>История выплат</strong>
          <small>Выплат пока не было</small>
        </span>
      </section>
    );
  }

  return (
    <section className={styles.history} aria-label="История купонных выплат">
      <button
        type="button"
        className={styles.summary}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={styles.icon} aria-hidden="true"><FiCalendar /></span>
        <span className={styles.summaryCopy}>
          <strong>История выплат</strong>
          <small>{yearCountLabel(yearGroups.length)} · {paymentCountLabel(bond.couponPayments.length)} · {formatMoney(bond.paidCouponTotal)}</small>
        </span>
        <span className={styles.latestPayment}>
          <small>Последняя</small>
          <b>{SHORT_DATE_FORMATTER.format(new Date(`${latestPayment.payDate}T00:00:00Z`))}</b>
        </span>
        <FiChevronDown className={styles.chevron} aria-hidden="true" />
      </button>

      <div
        id={panelId}
        className={styles.collapse}
        data-expanded={expanded}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className={styles.collapseInner}>
          <div className={styles.yearList}>
            {yearGroups.map((group) => {
              const yearPanelId = `${panelId}-${group.year}`;
              const yearExpanded = expandedYears.has(group.year);
              return (
                <section className={styles.yearGroup} key={group.year}>
                  <button
                    type="button"
                    className={styles.yearSummary}
                    aria-expanded={yearExpanded}
                    aria-controls={yearPanelId}
                    onClick={() => toggleYear(group.year)}
                  >
                    <span className={styles.yearIdentity}>
                      <strong>{group.year}</strong>
                      <small>{paymentCountLabel(group.payments.length)}</small>
                    </span>
                    <b>{formatMoney(group.total)}</b>
                    <FiChevronDown className={styles.chevron} aria-hidden="true" />
                  </button>
                  <div
                    id={yearPanelId}
                    className={`${styles.collapse} ${styles.yearCollapse}`}
                    data-expanded={yearExpanded}
                    aria-hidden={!yearExpanded}
                    inert={!yearExpanded}
                  >
                    <div className={styles.collapseInner}>
                      <div className={styles.yearPanel}>
                        <ol>
                          {group.payments.map((payment) => (
                            <li key={`${payment.payDate}-${payment.couponNumber}`}>
                              <time dateTime={payment.payDate}>{formatDate(payment.payDate)}</time>
                              <span className={styles.paymentDetails}>
                                <strong>Купон № {payment.couponNumber}</strong>
                                <small>{formatMoney(payment.amountPerBond)} × {payment.quantity.toLocaleString('ru-RU')} шт.</small>
                              </span>
                              <strong className={styles.paymentAmount}>+{formatMoney(payment.amount)}</strong>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

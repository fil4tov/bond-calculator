import { useId, useMemo, useState } from 'react';
import { FiCalendar, FiChevronDown } from 'react-icons/fi';

import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { Button } from '#shared/ui';

import { formatDate, formatMoney, todayInputValue } from '../../../../utils';
import styles from './CouponSchedule.module.scss';
import { groupCouponScheduleByYear, isZeroMoney } from './utils';

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

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface CouponScheduleProps {
  bond: BondPortfolioItem;
  onRefresh: () => Promise<void>;
}

export function CouponSchedule({ bond, onRefresh }: CouponScheduleProps) {
  const panelId = useId();
  const yearGroups = useMemo(
    () => groupCouponScheduleByYear(bond.couponSchedule),
    [bond.couponSchedule],
  );
  const latestEvent = yearGroups[0]?.events[0];
  const [expanded, setExpanded] = useState(false);
  const [yearExpansion, setYearExpansion] = useState<Map<number, boolean>>(() => new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const today = todayInputValue();

  const toggleYear = (year: number) => {
    setYearExpansion((current) => {
      const next = new Map(current);
      next.set(year, !(current.get(year) ?? false));
      return next;
    });
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    setAnnouncement('');
    try {
      await onRefresh();
      setAnnouncement('Расписание выплат обновлено');
    } catch (error) {
      const message = error instanceof ApiError && error.code === 'coupon_schedule_incomplete'
        ? 'T‑Invest вернул неполное расписание. Сохранённые данные не изменились.'
        : 'Не удалось обновить расписание. Попробуйте ещё раз.';
      setRefreshError(message);
      setAnnouncement(message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className={styles.schedule} aria-label="Расписание купонных выплат">
      <button
        type="button"
        className={styles.summary}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={styles.icon} aria-hidden="true"><FiCalendar /></span>
        <span className={styles.summaryCopy}>
          <strong>Расписание выплат</strong>
          <small>{yearCountLabel(yearGroups.length)} · {paymentCountLabel(bond.couponSchedule.length)}</small>
        </span>
        <span className={styles.latestPayment}>
          <small>До</small>
          <b>
            {latestEvent
              ? SHORT_DATE_FORMATTER.format(new Date(`${latestEvent.payDate}T00:00:00Z`))
              : '—'}
          </b>
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
          <div className={styles.schedulePanel}>
            <div className={styles.syncToolbar}>
              <span className={styles.updatedAt} aria-live="polite">
                Обновлено {UPDATED_AT_FORMATTER.format(new Date(bond.couponScheduleUpdatedAt))}
              </span>
              <Button
                type="button"
                variant="ghost"
                className={styles.refreshButton}
                disabled={refreshing}
                aria-busy={refreshing}
                onClick={() => void handleRefresh()}
              >
                {refreshing ? 'Обновляем…' : 'Обновить расписание'}
              </Button>
            </div>
            <span className={styles.visuallyHidden} role="status" aria-live="polite">
              {announcement}
            </span>
            {refreshError ? <p className={styles.refreshError} role="alert">{refreshError}</p> : null}

            {yearGroups.length ? (
              <div className={styles.yearList}>
                {yearGroups.map((group) => {
                  const yearPanelId = `${panelId}-${group.year}`;
                  const yearExpanded = yearExpansion.get(group.year) ?? false;
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
                          <small>{paymentCountLabel(group.events.length)}</small>
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
                              {group.events.map((event) => {
                                const amountUnknown = event.payDate > today
                                  && isZeroMoney(event.amountPerBond);
                                const amountIsZero = isZeroMoney(event.amount);
                                return (
                                  <li key={`${event.payDate}-${event.couponNumber}`}>
                                    <time dateTime={event.payDate}>{formatDate(event.payDate)}</time>
                                    <span className={styles.paymentDetails}>
                                      <strong>Купон № {event.couponNumber}</strong>
                                      <small>
                                        {amountUnknown
                                          ? `Размер не объявлен · ${event.quantity.toLocaleString('ru-RU')} шт.`
                                          : `${formatMoney(event.amountPerBond)} × ${event.quantity.toLocaleString('ru-RU')} шт.`}
                                      </small>
                                    </span>
                                    <strong
                                      className={styles.paymentAmount}
                                      data-zero={amountIsZero}
                                    >
                                      {amountIsZero ? '' : '+'}{formatMoney(event.amount)}
                                    </strong>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <p className={styles.empty}>Купонные выплаты не предусмотрены</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

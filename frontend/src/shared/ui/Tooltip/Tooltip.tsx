import { useId, useRef } from 'react';
import type { ReactNode } from 'react';

import styles from './Tooltip.module.scss';

interface TooltipProps { label: string; children: ReactNode; align?: 'left' | 'right' }

export function Tooltip({ label, children, align = 'left' }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);

  const updateMobilePosition = () => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content || !window.matchMedia('(max-width: 580px)').matches) return;

    const edgeOffset = 16;
    const tooltipGap = 10;
    const maxTooltipHeight = 280;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipHeight = Math.min(content.scrollHeight, maxTooltipHeight);
    const availableAbove = triggerRect.top - tooltipGap - edgeOffset;
    const availableBelow = window.innerHeight - triggerRect.bottom - tooltipGap - edgeOffset;
    const placeAbove = availableAbove >= tooltipHeight
      || (availableBelow < tooltipHeight && availableAbove >= availableBelow);
    const availableHeight = Math.max(0, placeAbove ? availableAbove : availableBelow);

    content.dataset.mobilePlacement = placeAbove ? 'above' : 'below';
    content.style.setProperty('--tooltip-mobile-left', `${edgeOffset - triggerRect.left}px`);
    content.style.setProperty('--tooltip-mobile-max-height', `${availableHeight}px`);
  };

  return (
    <span className={`${styles.tooltip} ${styles[align]}`}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-describedby={id}
        onFocus={updateMobilePosition}
        onPointerDown={updateMobilePosition}
        onPointerEnter={updateMobilePosition}
      >
        ?
      </button>
      <span ref={contentRef} id={id} className={styles.content} role="tooltip">{children}</span>
    </span>
  );
}

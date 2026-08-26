import { useId, useRef } from 'react';
import type { ReactNode } from 'react';

import styles from './Tooltip.module.scss';

interface TooltipProps { label: string; children: ReactNode; align?: 'left' | 'right' }

export function Tooltip({ label, children, align = 'left' }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const edgeOffset = 16;
    const tooltipGap = 10;
    const maxTooltipHeight = 280;
    const triggerRect = trigger.getBoundingClientRect();
    let clippingAncestor: HTMLElement | null = trigger.parentElement;
    while (clippingAncestor) {
      const { overflowX, overflowY } = window.getComputedStyle(clippingAncestor);
      if ([overflowX, overflowY].some((overflow) => (
        overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden'
      ))) break;
      clippingAncestor = clippingAncestor.parentElement;
    }
    const clippingRect = clippingAncestor?.getBoundingClientRect();
    const boundaryTop = Math.max(edgeOffset, clippingRect?.top ?? edgeOffset);
    const boundaryBottom = Math.min(
      window.innerHeight - edgeOffset,
      clippingRect?.bottom ?? window.innerHeight - edgeOffset,
    );
    const tooltipHeight = Math.min(content.scrollHeight, maxTooltipHeight);
    const availableAbove = triggerRect.top - tooltipGap - boundaryTop;
    const availableBelow = boundaryBottom - triggerRect.bottom - tooltipGap;
    const placeAbove = availableAbove >= tooltipHeight
      || (availableBelow < tooltipHeight && availableAbove >= availableBelow);
    const availableHeight = Math.max(0, placeAbove ? availableAbove : availableBelow);

    content.dataset.placement = placeAbove ? 'above' : 'below';
    content.style.removeProperty('--tooltip-shift-x');
    if (window.matchMedia('(max-width: 580px)').matches) {
      content.style.setProperty('--tooltip-mobile-left', `${edgeOffset - triggerRect.left}px`);
      content.style.setProperty('--tooltip-mobile-max-height', `${availableHeight}px`);
      return;
    }

    const horizontalInset = 12;
    const boundaryLeft = Math.max(
      edgeOffset,
      (clippingRect?.left ?? 0) + horizontalInset,
    );
    const boundaryRight = Math.min(
      window.innerWidth - edgeOffset,
      (clippingRect?.right ?? window.innerWidth) - horizontalInset,
    );
    const contentRect = content.getBoundingClientRect();
    const shiftX = contentRect.left < boundaryLeft
      ? boundaryLeft - contentRect.left
      : contentRect.right > boundaryRight
        ? boundaryRight - contentRect.right
        : 0;
    content.style.setProperty('--tooltip-shift-x', `${shiftX}px`);
  };

  return (
    <span className={`${styles.tooltip} ${styles[align]}`}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-describedby={id}
        onFocus={updatePosition}
        onPointerDown={updatePosition}
        onPointerEnter={updatePosition}
      >
        ?
      </button>
      <span ref={contentRef} id={id} className={styles.content} role="tooltip">{children}</span>
    </span>
  );
}

import { useLayoutEffect, useRef } from 'react';

export const useFirstRowLabelAlignment = () => {
  const formGridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = formGridRef.current;
    const priceLabel = grid?.children[1]?.querySelector<HTMLElement>('span:first-child');
    if (!grid || !priceLabel) return undefined;

    const alignNominalLabel = () => {
      grid.style.setProperty('--first-row-label-height', `${priceLabel.getBoundingClientRect().height}px`);
    };

    alignNominalLabel();
    window.addEventListener('resize', alignNominalLabel);

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(alignNominalLabel);
    resizeObserver?.observe(priceLabel);

    return () => {
      window.removeEventListener('resize', alignNominalLabel);
      resizeObserver?.disconnect();
    };
  }, []);

  return formGridRef;
};

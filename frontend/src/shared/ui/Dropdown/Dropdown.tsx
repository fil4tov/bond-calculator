import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import styles from './Dropdown.module.scss';
import { getDropdownPlacement } from './utils';

interface TriggerProps {
  ref: React.RefObject<HTMLButtonElement | null>;
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
}

interface DropdownProps {
  trigger: (props: TriggerProps) => ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  contentClassName?: string;
  mobileMode?: 'sheet' | 'anchored';
}

export function Dropdown({
  trigger,
  children,
  open: controlledOpen,
  onOpenChange,
  className = '',
  contentClassName = '',
  mobileMode = 'sheet',
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');

  const setOpen = useCallback((next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const updatePlacement = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) return;

      const isMobile = window.matchMedia('(max-width: 580px)').matches;
      if (isMobile && mobileMode === 'sheet') {
        setPlacement('bottom');
        return;
      }

      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const triggerBounds = trigger.getBoundingClientRect();

      setPlacement(getDropdownPlacement({
        contentHeight: content.offsetHeight,
        gap: isMobile ? 8 : 12,
        triggerTop: triggerBounds.top,
        triggerBottom: triggerBounds.bottom,
        viewportTop,
        viewportBottom,
      }));
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    window.visualViewport?.addEventListener('resize', updatePlacement);
    window.visualViewport?.addEventListener('scroll', updatePlacement);

    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
      window.visualViewport?.removeEventListener('resize', updatePlacement);
      window.visualViewport?.removeEventListener('scroll', updatePlacement);
    };
  }, [mobileMode, open]);

  return (
    <div ref={rootRef} className={`${styles.root} ${className}`}>
      {trigger({ ref: triggerRef, 'aria-expanded': open, 'aria-controls': contentId, onClick: () => setOpen(!open) })}
      {open ? (
        <div
          ref={contentRef}
          id={contentId}
          className={`${styles.content} ${placement === 'top' ? styles.openAbove : ''} ${mobileMode === 'anchored' ? styles.mobileAnchored : ''} ${contentClassName}`}
          data-placement={placement}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

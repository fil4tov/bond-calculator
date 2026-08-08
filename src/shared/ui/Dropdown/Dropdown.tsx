import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import styles from './Dropdown.module.scss';

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
}

export function Dropdown({ trigger, children, open: controlledOpen, onOpenChange, className = '', contentClassName = '' }: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentId = useId();

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

  return (
    <div ref={rootRef} className={`${styles.root} ${className}`}>
      {trigger({ ref: triggerRef, 'aria-expanded': open, 'aria-controls': contentId, onClick: () => setOpen(!open) })}
      {open ? <div id={contentId} className={`${styles.content} ${contentClassName}`}>{children}</div> : null}
    </div>
  );
}

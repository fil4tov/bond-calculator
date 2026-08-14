import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { FiX } from 'react-icons/fi';

import styles from './Modal.module.scss';
import { focusableElements, mountModal, topmostModal, unmountModal } from './utils';
import type { ModalStackEntry } from './utils';

export interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
  returnFocusTarget?: HTMLElement | null;
  width?: 'narrow' | 'wide';
  mobileFillHeight?: boolean;
  mobileContentFillsHeight?: boolean;
}

export function Modal({
  title,
  subtitle,
  eyebrow,
  children,
  busy = false,
  onClose,
  returnFocusTarget,
  width = 'narrow',
  mobileFillHeight = false,
  mobileContentFillsHeight = false,
}: ModalProps) {
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const returnFocusRef = useRef<HTMLElement | null>(returnFocusTarget ?? null);
  const stackEntryRef = useRef<ModalStackEntry | null>(null);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const requestClose = () => {
    const entry = stackEntryRef.current;
    if (entry && topmostModal() === entry && !busyRef.current) onCloseRef.current();
  };

  useEffect(() => {
    const previousFocus = returnFocusRef.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = focusableElements(dialog);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const entry: ModalStackEntry = {
      dialog,
      closeButton: closeRef.current,
      previousFocus,
      handleKeyDown,
    };
    stackEntryRef.current = entry;
    mountModal(entry);
    closeRef.current?.focus();

    return () => {
      stackEntryRef.current = null;
      unmountModal(entry);
    };
  }, []);

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  return (
    <div className={styles.backdrop} onMouseDown={handleBackdrop}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles[width]} ${mobileFillHeight ? styles.mobileFillHeight : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
      >
        <div
          className={`${styles.scrollViewport} ${mobileContentFillsHeight ? styles.mobileContentFillsHeight : ''}`}
          data-modal-scroll-viewport
        >
          <div className={styles.header}>
            <div>
              {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
              <h2 id={titleId}>{title}</h2>
              {subtitle ? <p id={subtitleId} className={styles.subtitle}>{subtitle}</p> : null}
            </div>
            <button
              ref={closeRef}
              type="button"
              className={styles.close}
              aria-label="Закрыть окно"
              disabled={busy}
              onClick={requestClose}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

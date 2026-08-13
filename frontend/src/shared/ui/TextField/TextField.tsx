import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

import styles from './TextField.module.scss';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  unit?: ReactNode;
  error?: string;
  wide?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, unit, error, wide, className = '', id: providedId, ...props }, ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;

  return (
    <label className={`${styles.field} ${wide ? styles.wide : ''} ${className}`} htmlFor={id}>
      <span className={styles.label}>{label}{hint ? <small>{hint}</small> : null}</span>
      <span className={styles.wrap}>
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {unit ? <span className={styles.unit} aria-hidden="true">{unit}</span> : null}
      </span>
      {error ? <span id={errorId} className={styles.error} role="alert">{error}</span> : null}
    </label>
  );
});

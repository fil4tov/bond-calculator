import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './Button.module.scss';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', trailingIcon, className = '', children, ...props },
  ref,
) {
  return (
    <button ref={ref} className={`${styles.button} ${styles[variant]} ${className}`} {...props}>
      <span>{children}</span>
      {trailingIcon ? <span className={styles.icon} aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
});

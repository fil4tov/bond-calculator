import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './Button.module.scss';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  trailingIcon?: ReactNode;
}

export function Button({ variant = 'primary', trailingIcon, className = '', children, ...props }: ButtonProps) {
  return (
    <button className={`${styles.button} ${styles[variant]} ${className}`} {...props}>
      <span>{children}</span>
      {trailingIcon ? <span className={styles.icon} aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
}

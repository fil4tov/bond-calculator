import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './Button.module.scss';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  size?: 'small' | 'medium';
}

export function IconButton({ icon, size = 'medium', className = '', ...props }: IconButtonProps) {
  return (
    <button className={`${styles.iconButton} ${styles[size]} ${className}`} {...props}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

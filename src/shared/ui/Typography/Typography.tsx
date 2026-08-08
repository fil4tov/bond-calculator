import type { ElementType, HTMLAttributes, ReactNode } from 'react';

import styles from './Typography.module.scss';

type Variant = 'display' | 'title' | 'body' | 'label' | 'metric';
interface TypographyProps extends HTMLAttributes<HTMLElement> { as?: ElementType; variant?: Variant; children: ReactNode }

export function Typography({ as: Component = 'p', variant = 'body', className = '', children, ...props }: TypographyProps) {
  return <Component className={`${styles[variant]} ${className}`} {...props}>{children}</Component>;
}

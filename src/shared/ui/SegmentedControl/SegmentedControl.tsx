import styles from './SegmentedControl.module.scss';

export interface SegmentedOption<T extends string> { value: T; label: string }

interface SegmentedControlProps<T extends string> {
  name: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  compact?: boolean;
}

export function SegmentedControl<T extends string>({ name, value, options, onChange, ariaLabel, compact }: SegmentedControlProps<T>) {
  return (
    <div className={`${styles.control} ${compact ? styles.compact : ''}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <span key={option.value}>
            <input id={id} type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            <label htmlFor={id}>{option.label}</label>
          </span>
        );
      })}
    </div>
  );
}

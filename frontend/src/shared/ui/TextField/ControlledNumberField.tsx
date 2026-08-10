import type { InputHTMLAttributes, ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import type { Control, ControllerProps, FieldPath, FieldValues } from 'react-hook-form';

import { formatEditableNumber, formatInputNumber, parseFormattedNumber } from '#shared/lib/number';

import { NumberField } from './NumberField';

export interface ControlledNumberFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'name' | 'value'> {
  control: Control<TFieldValues>;
  name: TName;
  rules?: ControllerProps<TFieldValues, TName>['rules'];
  label: ReactNode;
  hint?: ReactNode;
  unit?: ReactNode;
  integer?: boolean;
  wide?: boolean;
  error?: string;
}

export function ControlledNumberField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  rules,
  label,
  hint,
  unit,
  integer,
  wide,
  error,
  onFocus,
  onBlur,
  ...inputProps
}: ControlledNumberFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <NumberField
          {...inputProps}
          ref={field.ref}
          id={inputProps.id ?? String(name)}
          name={field.name}
          label={label}
          hint={hint}
          unit={unit}
          wide={wide}
          error={error}
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={(event) => field.onChange(event.target.value)}
          onFocus={(event) => {
            field.onChange(formatEditableNumber(parseFormattedNumber(event.currentTarget.value)));
            onFocus?.(event);
          }}
          onBlur={(event) => {
            field.onChange(formatInputNumber(event.currentTarget.value, integer));
            field.onBlur();
            onBlur?.(event);
          }}
        />
      )}
    />
  );
}

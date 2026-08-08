import { forwardRef } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import { containsDisallowedMinus, isValidNumericDraft } from '#shared/lib/number';

import { TextField } from './TextField';
import type { TextFieldProps } from './TextField';

export type NumberFieldProps = Omit<TextFieldProps, 'type'>;

function getValueAfterInsertion(input: HTMLInputElement, insertedValue: string) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  return `${input.value.slice(0, start)}${insertedValue}${input.value.slice(end)}`;
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(props, ref) {
  const { onChange, onKeyDown, onBeforeInput, value, ...rest } = props;
  return (
    <TextField
      ref={ref}
      type="text"
      value={value}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        const isModified = event.ctrlKey || event.metaKey || event.altKey;
        if (!isModified && event.key.length === 1) {
          const next = getValueAfterInsertion(event.currentTarget, event.key);
          if (containsDisallowedMinus(event.key) || !isValidNumericDraft(next)) event.preventDefault();
        }
        onKeyDown?.(event);
      }}
      onBeforeInput={(event) => {
        const data = event.nativeEvent instanceof InputEvent ? event.nativeEvent.data : null;
        if (data !== null) {
          const next = getValueAfterInsertion(event.currentTarget, data);
          if (containsDisallowedMinus(data) || !isValidNumericDraft(next)) event.preventDefault();
        }
        onBeforeInput?.(event);
      }}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        if (isValidNumericDraft(event.currentTarget.value) && !containsDisallowedMinus(event.currentTarget.value)) {
          onChange?.(event);
          return;
        }

        if (value !== undefined) event.currentTarget.value = String(value);
      }}
      {...rest}
    />
  );
});

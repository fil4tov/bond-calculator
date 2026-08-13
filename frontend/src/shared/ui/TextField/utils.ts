export function getValueAfterInsertion(input: HTMLInputElement, insertedValue: string) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  return `${input.value.slice(0, start)}${insertedValue}${input.value.slice(end)}`;
}

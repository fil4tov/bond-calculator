export function formatOperationCount(count: number) {
  const category = new Intl.PluralRules('ru-RU').select(count);
  const label = category === 'one' ? 'операция' : category === 'few' ? 'операции' : 'операций';
  return `${count.toLocaleString('ru-RU')} ${label}`;
}

export function localizedFieldError(field: string) {
  if (field === 'quantity') return 'Количество превышает доступный остаток на выбранную дату';
  if (field === 'sale_date') return 'Дата продажи должна быть не раньше размещения и раньше погашения';
  if (field === 'amount_received') return 'Проверьте сумму продажи';
  return null;
}

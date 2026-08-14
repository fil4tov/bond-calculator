export function localizedSubmitError(code: string) {
  return code === 'validation_error'
    ? 'Не удалось проверить данные продажи. Проверьте поля и попробуйте снова.'
    : 'Не удалось зафиксировать продажу. Проверьте подключение и попробуйте снова.';
}

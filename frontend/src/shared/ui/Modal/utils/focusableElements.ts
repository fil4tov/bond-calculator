const FOCUSABLE = 'button, input, select, textarea, [href], [tabindex]';

export function focusableElements(dialog: HTMLDivElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    if (element.matches(':disabled') || element.tabIndex < 0 || element.closest('[hidden]')) return false;
    if (element instanceof HTMLInputElement && element.type === 'hidden') return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

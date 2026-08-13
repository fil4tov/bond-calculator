export function resultSign(value: string) {
  if (/^-?0+(?:\.0+)?$/.test(value)) return 'zero' as const;
  return value.startsWith('-') ? 'negative' as const : 'positive' as const;
}

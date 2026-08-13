export function moneyToKopecks(value: string | null): bigint | null {
  if (value === null) return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const sign = match[1] ?? '';
  const rubles = match[2]!;
  const fraction = match[3] ?? '';
  const kopecks = BigInt(rubles) * 100n + BigInt(fraction.padEnd(2, '0'));
  return sign === '-' ? -kopecks : kopecks;
}

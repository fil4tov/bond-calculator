const FRACTION_DIGITS = 4;
const FRACTION_SCALE = 10n ** BigInt(FRACTION_DIGITS);
const PERCENT_SCALE = 100n * FRACTION_SCALE;

export function percentOf(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) return null;

  const scaled = (numerator * PERCENT_SCALE + denominator / 2n) / denominator;
  const integer = scaled / FRACTION_SCALE;
  const fraction = (scaled % FRACTION_SCALE).toString().padStart(FRACTION_DIGITS, '0');

  return `${integer}.${fraction}`;
}

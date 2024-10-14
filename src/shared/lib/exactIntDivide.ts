/**
 * Returns numerator / denominator, with explicit handling
 * of rounding up or down in the case of a remainder.
 */
export const exactIntDivide = (
  numerator: number,
  denominator: number,
  opts: { round: 'up' | 'down' }
): number => {
  const remainder = numerator % denominator;
  if (remainder === 0) {
    return numerator / denominator;
  }
  const roundedDown = (numerator - remainder) / denominator;
  if (opts.round === 'down') {
    return roundedDown;
  }
  return roundedDown + 1;
};

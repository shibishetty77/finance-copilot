/**
 * Indian Rupee currency formatter.
 * Uses the Indian number system (lakhs, crores).
 */

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const INR_COMPACT_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Format a number as ₹1,23,456.00 */
export function formatCurrency(amount: number): string {
  return INR_FORMATTER.format(amount);
}

/** Format large numbers compactly: ₹12.5L, ₹1.2Cr */
export function formatCurrencyCompact(amount: number): string {
  return INR_COMPACT_FORMATTER.format(amount);
}

/** Format as plain number with Indian commas: 1,23,456 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(amount);
}

/** Format P&L with +/- prefix */
export function formatPnL(amount: number): string {
  const prefix = amount >= 0 ? '+' : '';
  return `${prefix}${formatCurrency(amount)}`;
}

/** Format percentage */
export function formatPercent(value: number, decimals = 1): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}

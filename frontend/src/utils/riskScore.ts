/**
 * Get color classes for risk score
 * 0-30: Green (Low risk)
 * 31-60: Yellow (Medium risk)
 * 61-100: Red (High risk)
 */
export function getRiskScoreColor(score: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (score <= 30) {
    return {
      bg: 'bg-income/20',
      text: 'text-income',
      border: 'border-income/30',
    };
  } else if (score <= 60) {
    return {
      bg: 'bg-yellow-600/20',
      text: 'text-yellow-400',
      border: 'border-yellow-600/30',
    };
  } else {
    return {
      bg: 'bg-expense/20',
      text: 'text-expense',
      border: 'border-expense/30',
    };
  }
}

/**
 * Get risk level label
 */
export function getRiskLevelLabel(score: number): string {
  if (score <= 30) return 'Low Risk';
  if (score <= 60) return 'Medium Risk';
  return 'High Risk';
}

/**
 * Get color for score widget display
 */
export function getScoreWidgetColor(score: number): string {
  if (score >= 80) return 'bg-income/20 text-income';
  if (score >= 60) return 'bg-brand-600/20 text-brand-400';
  if (score >= 40) return 'bg-yellow-600/20 text-yellow-400';
  return 'bg-expense/20 text-expense';
}

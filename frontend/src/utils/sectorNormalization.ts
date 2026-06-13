/**
 * Normalize sector names to title case for consistent grouping and display
 * Examples:
 * - "it" -> "IT"
 * - "It" -> "IT"
 * - "iT" -> "IT"
 * - "marketing" -> "Marketing"
 * - "FINANCE" -> "Finance"
 */
export function normalizeSector(sector: string | null | undefined): string {
  if (!sector) return 'Unclassified';

  // Special cases for all-caps sectors
  const specialCases: Record<string, string> = {
    it: 'IT',
    bfsi: 'BFSI',
    reit: 'REIT',
  };

  const lowerCased = sector.trim().toLowerCase();

  if (specialCases[lowerCased]) {
    return specialCases[lowerCased];
  }

  // Title case: capitalize first letter of each word
  return sector
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Group holdings by normalized sector
 */
export function groupByNormalizedSector(
  holdings: Array<{ sector?: string; [key: string]: any }>,
): Map<string, typeof holdings> {
  const map = new Map<string, typeof holdings>();

  holdings.forEach((holding) => {
    const normalizedSector = normalizeSector(holding.sector);
    if (!map.has(normalizedSector)) {
      map.set(normalizedSector, []);
    }
    map.get(normalizedSector)!.push(holding);
  });

  return map;
}

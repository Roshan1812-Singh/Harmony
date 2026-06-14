/**
 * Deterministic, ASCII-safe slug generator.
 * Lower-cases, collapses runs of non-alphanumeric to a single hyphen, trims edges,
 * and caps length at 80. Unicode → NFKD then strip diacritics.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

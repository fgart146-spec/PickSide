// Escape ILIKE wildcards so a literal "%" or "_" in a search box is matched
// as text, not treated as a pattern wildcard.
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

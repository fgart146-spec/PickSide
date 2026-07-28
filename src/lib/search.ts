// Escape ILIKE wildcards so a literal "%" or "_" in a search box is matched
// as text, not treated as a pattern wildcard.
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

// Quote a value used inside a PostgREST `.or()`/`.filter()` string so
// reserved characters (",", ".", "(", ")") in user input can't inject
// extra filter conditions. Wrap in double quotes and escape "\" and """.
export function quoteOrValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

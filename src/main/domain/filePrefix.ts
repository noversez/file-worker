export function normalizePrefixes(rawText: string): string[] {
  return rawText
    .split(/\r?\n|,|;/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function matchesPrefix(name: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      return prefix;
    }
  }
  return null;
}

export function cleanName(name: string, prefix: string): string {
  const cleaned = name.slice(prefix.length).replace(/^[ \t\-_.\]]+/, '');
  return cleaned.trim().length > 0 ? cleaned : name;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function matchesSearch(name: string, query: string): boolean {
  if (!query.trim()) return true;
  const normalizedName = normalize(name);
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
  return tokens.every((token) => normalizedName.includes(token));
}

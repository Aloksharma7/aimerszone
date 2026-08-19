export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

/**
 * The free-text search term for a list page.
 *
 * `search` is the canonical name; `q` is accepted so links and bookmarks made
 * before the header form was corrected keep working.
 */
export function searchTerm(raw: Record<string, string | string[] | undefined>): string {
  return firstParam(raw.search) || firstParam(raw.q);
}

export function matchesQuery(query: string, ...values: unknown[]): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return values.some((value) => String(value ?? "").toLocaleLowerCase().includes(normalized));
}

export function buildQueryString(values: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value.trim()) params.set(key, value.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

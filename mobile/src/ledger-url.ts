import {
  parseLedgerFilters,
  toLedgerQuery,
  type LedgerFilters,
} from "@/features/finance/ledger";
/** Namespaced so search, recovery and other app links are preserved. */
export function ledgerFromUrl(url: URL): LedgerFilters {
  const params = new URLSearchParams();
  for (const key of ["type", "paid", "days", "q"]) {
    const value = url.searchParams.get(`ledger_${key}`);
    if (value !== null) params.set(key, value);
  }
  return parseLedgerFilters(params);
}
export function ledgerUrl(url: URL, filters: LedgerFilters): URL {
  const next = new URL(url);
  for (const key of ["type", "paid", "days", "q"])
    next.searchParams.delete(`ledger_${key}`);
  for (const [key, value] of new URLSearchParams(toLedgerQuery(filters)))
    next.searchParams.set(`ledger_${key}`, value);
  next.searchParams.set("page", "finance");
  return next;
}

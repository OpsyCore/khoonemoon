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
export function ledgerCurrency(url: URL): string {
  const currency = url.searchParams.get("ledger_currency") ?? "";
  return /^[A-Z]{3}$/.test(currency) ? currency : "IRR";
}
export function ledgerUrl(
  url: URL,
  filters: LedgerFilters,
  currency = "IRR",
): URL {
  const next = new URL(url);
  for (const key of ["type", "paid", "days", "q"])
    next.searchParams.delete(`ledger_${key}`);
  for (const [key, value] of new URLSearchParams(toLedgerQuery(filters)))
    next.searchParams.set(`ledger_${key}`, value);
  next.searchParams.delete("ledger_currency");
  if (/^[A-Z]{3}$/.test(currency) && currency !== "IRR")
    next.searchParams.set("ledger_currency", currency);
  next.searchParams.set("page", "finance");
  return next;
}

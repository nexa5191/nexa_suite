// All amounts are stored in a single base currency (INR) and converted to the
// active display currency at render time — the same pattern used across NEXA's
// reports so every statement stays internally consistent.

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  rate: number; // units per 1 INR (base)
  locale: string;
}

export const BASE_CURRENCY = "INR";

export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", rate: 1, locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", rate: 0.012, locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", rate: 0.011, locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", rate: 0.0095, locale: "en-GB" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", rate: 0.044, locale: "en-AE" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", rate: 0.016, locale: "en-SG" },
];

export function currencyByCode(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function formatMoney(base: number, currency: Currency): string {
  const value = base * currency.rate;
  const fractionless = Math.abs(value) >= 100000;
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    maximumFractionDigits: fractionless ? 0 : 2,
    minimumFractionDigits: fractionless ? 0 : 2,
  }).format(value);
}

/** Compact notation — Lakh/Crore for INR, M/B otherwise. */
export function formatCompact(base: number, currency: Currency): string {
  const value = base * currency.rate;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const sym = currency.symbol;
  if (currency.code === "INR") {
    if (abs >= 1e7) return `${sign}${sym}${(abs / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `${sign}${sym}${(abs / 1e5).toFixed(2)} L`;
    if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${sym}${abs.toFixed(0)}`;
  }
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

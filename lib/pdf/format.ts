// Shared helpers for jsPDF documents.
//
// NOTE: the built-in PDF fonts (Helvetica) have no ₹ glyph, so money is prefixed
// with "Rs" rather than the rupee sign to avoid a missing-glyph box.

export function inr(n: number): string {
  return "Rs " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function num(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

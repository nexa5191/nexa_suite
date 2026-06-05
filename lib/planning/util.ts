// Small shared helpers for the planning modules. `formatCompactInr` renders a
// base-INR amount compactly (Lakh/Crore) without going through the display-
// currency layer — handy for chart axes and dense grids.

export { cn } from "@/lib/utils";

export function formatCompactInr(base: number): string {
  const abs = Math.abs(base);
  const sign = base < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

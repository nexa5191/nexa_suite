export interface Period {
  id: string;
  label: string;
  from: string;
  to: string;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fyStartYear(d: Date): number {
  return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}

export function fyLabel(startYear: number): string {
  return `FY ${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

// Indian financial year (Apr–Mar). `ref` is "today".
export function periodPresets(ref: Date): Period[] {
  const fyS = fyStartYear(ref);
  const thisFyFrom = `${fyS}-04-01`;
  const lastFyFrom = `${fyS - 1}-04-01`;
  const lastFyTo = `${fyS}-03-31`;

  const last12From = new Date(ref);
  last12From.setFullYear(ref.getFullYear() - 1);
  last12From.setDate(last12From.getDate() + 1);

  const qStartMonth = Math.floor(ref.getMonth() / 3) * 3;
  const qFrom = new Date(ref.getFullYear(), qStartMonth, 1);
  const mFrom = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const refStr = ymd(ref);

  return [
    { id: "last12", label: "Last 12 months", from: ymd(last12From), to: refStr },
    { id: "thisfy", label: `This FY (${fyLabel(fyS)})`, from: thisFyFrom, to: refStr },
    { id: "lastfy", label: `Last FY (${fyLabel(fyS - 1)})`, from: lastFyFrom, to: lastFyTo },
    { id: "quarter", label: "This quarter", from: ymd(qFrom), to: refStr },
    { id: "month", label: "This month", from: ymd(mFrom), to: refStr },
  ];
}

export const DEFAULT_PERIOD_ID = "last12";

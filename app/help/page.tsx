import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const TOPICS = [
  {
    q: "Cash vs Accrual basis",
    a: "Toggle the basis in the top bar. Accrual recognises income when invoiced and expenses when billed; cash recognises both only when money actually moves. Every statement recomputes instantly from the same ledger.",
  },
  {
    q: "Scope: entity, location & state",
    a: "Use the selectors in the top bar to drill from the whole group down to a single entity, branch location, or GST state. The reports and ledger respect the active scope.",
  },
  {
    q: "Multi-currency",
    a: "All amounts are held in INR (base) and converted to your chosen display currency on the fly — switch currency in the top bar. Indian figures use Lakh/Crore compaction.",
  },
  {
    q: "Exporting",
    a: "Every statement has Excel (CSV) and PDF buttons. The PDF opens a print-ready view; the CSV downloads figures already converted to the active currency.",
  },
  {
    q: "Reports available",
    a: "Profit & Loss, Balance Sheet and Cash Flow today. The Chart of Accounts shows live balances, and the General Ledger lists every double-entry posting.",
  },
];

export default function Page() {
  return (
    <>
      <PageHeader title="Help & how-to" subtitle="Getting the most out of NEXA." />
      <div className="grid gap-3 md:grid-cols-2">
        {TOPICS.map((t) => (
          <Card key={t.q}>
            <CardHeader>
              <CardTitle>{t.q}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

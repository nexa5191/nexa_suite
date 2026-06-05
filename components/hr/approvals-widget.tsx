"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X, ArrowRight, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { allApprovals, loadDecisions, saveDecisions, type Decision } from "@/lib/hr/approvals";
import { KIND_META } from "./approval-meta";

export function ApprovalsWidget({ limit = 5 }: { limit?: number }) {
  const approvals = React.useMemo(() => allApprovals(), []);
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({});

  React.useEffect(() => {
    setDecisions(loadDecisions());
  }, []);

  function decide(id: string, decision: Decision) {
    setDecisions((prev) => {
      const next = { ...prev, [id]: decision };
      saveDecisions(next);
      return next;
    });
  }

  const pending = approvals.filter((a) => !decisions[a.id]);
  const shown = pending.slice(0, limit);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-4" /> Pending Approvals
          {pending.length > 0 && <Badge variant="warning">{pending.length}</Badge>}
        </CardTitle>
        <Link href="/approvals">
          <Button variant="ghost" size="sm">View all <ArrowRight className="size-3.5" /></Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">All caught up — no pending approvals.</p>
        ) : (
          shown.map((a) => {
            const meta = KIND_META[a.kind];
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <span className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  meta.tone === "primary" && "bg-primary/10 text-primary",
                  meta.tone === "warning" && "bg-warning/15 text-warning",
                  meta.tone === "default" && "bg-secondary text-secondary-foreground",
                )}>
                  <meta.Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.requestedByName} · {formatDate(a.requestedOn)}
                  </p>
                </div>
                {a.amount != null && (
                  <Money value={a.amount} compact className="shrink-0 text-sm font-semibold" />
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => decide(a.id, "rejected")}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Reject"
                  >
                    <X className="size-4" />
                  </button>
                  <button
                    onClick={() => decide(a.id, "approved")}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"
                    aria-label="Approve"
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
import { RotateCcw, Shell, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { resetDemoData, pendingChangeCount, RESET_MODULES } from "@/lib/data-reset";

export function DataResetCard() {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(0);
  const [done, setDone] = React.useState(false);

  // localStorage is client-only — read after mount to avoid hydration mismatch.
  React.useEffect(() => setPending(pendingChangeCount()), []);

  function confirmReset() {
    resetDemoData();
    setDone(true);
    // Reload so every module rebuilds its in-memory state from fresh seed.
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <Card className="mt-4 border-danger/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shell className="size-4" /> Reset to Bare Shell
          {pending > 0 && (
            <Badge variant="warning" className="ml-1">{pending} module{pending === 1 ? "" : "s"} with data</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Wipe all locally stored business data and return every module to its empty starting state.
          Your theme, layout and Excel templates are kept.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <RotateCcw className="size-3.5" /> Reset to bare shell
        </Button>
      </CardContent>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset to bare shell?"
        description="All locally stored business data will be cleared and the app will reload empty."
        footer={
          !done && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={confirmReset}>
                <RotateCcw className="size-3.5" /> Yes, clear everything
              </Button>
            </>
          )
        }
      >
        {done ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <RotateCcw className="size-4" /> Cleared — reloading…
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>This permanently discards all locally stored records in the modules below and cannot be undone.</span>
            </div>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
              {RESET_MODULES.map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" /> {m}
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </Card>
  );
}

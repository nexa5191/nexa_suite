"use client";

import * as React from "react";
import { DatabaseZap, RotateCcw, TriangleAlert } from "lucide-react";
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
          <DatabaseZap className="size-4" /> Demo Data
          {pending > 0 && (
            <Badge variant="warning" className="ml-1">{pending} module{pending === 1 ? "" : "s"} edited</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Clear out everything you&apos;ve changed and reload the original, mutually-consistent test
          dataset across all modules. Your theme, layout and Excel templates are kept.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <RotateCcw className="size-3.5" /> Reset &amp; reload fresh data
        </Button>
      </CardContent>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset all demo data?"
        description="This restores the fresh seed dataset and reloads the app."
        footer={
          !done && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={confirmReset}>
                <RotateCcw className="size-3.5" /> Reset everything
              </Button>
            </>
          )
        }
      >
        {done ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <RotateCcw className="size-4" /> Fresh data loaded — reloading…
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>This permanently discards local edits in the modules below and cannot be undone.</span>
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

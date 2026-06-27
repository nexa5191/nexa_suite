"use client";
import * as React from "react";
import { DatabaseZap, Download, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { loadDemoData, DEMO_MODULES } from "@/lib/demo-data";

export function DemoLoadCard() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  function confirm() {
    setLoading(true);
    loadDemoData(); // writes localStorage then reloads
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseZap className="size-4" /> Load Demo Data
        </CardTitle>
        <CardDescription>
          Populate every module with a consistent sample dataset — entities, items, vendors,
          customers, employees and bank accounts — so you can explore the full feature set.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Download className="size-3.5" /> Load demo data
        </Button>
      </CardContent>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Load demo data?"
        description="This writes sample records across all modules and reloads the app."
        footer={
          !loading && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={confirm}>
                <Download className="size-3.5" /> Yes, load demo data
              </Button>
            </>
          )
        }
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading — reloading app…</p>
        ) : (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>Any data you&apos;ve already entered will be overwritten by demo records.</span>
            </div>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
              {DEMO_MODULES.map((m) => (
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

"use client";

import * as React from "react";
import {
  Plug, RefreshCw, Check, Database, Settings2, ArrowRight, ShieldCheck,
  Loader2, Unplug, Layers, CheckCircle2, ArrowRightLeft, Circle, PartyPopper,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, Drawer } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CONNECTORS, DATASETS, SAMPLE_MAPPING, connectorById, totalRecords,
  TALLY_MIGRATION, MIGRATION_RESULT,
  type Connector, type DatasetVolume,
} from "@/lib/connections";

interface Connection {
  connectorId: string;
  account: string;
  env: string;
  connectedAt: string;
  lastSync: string;
  records: DatasetVolume;
}

const KEY = "nexa-connections";
const nowIso = () => new Date().toISOString();

function load(): Record<string, Connection> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Connection>) : {};
  } catch {
    return {};
  }
}
function persist(v: Record<string, Connection>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
const compact = (n: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function ConnectionsClient() {
  const [conns, setConns] = React.useState<Record<string, Connection>>({});
  const [hydrated, setHydrated] = React.useState(false);
  const [connecting, setConnecting] = React.useState<Connector | null>(null);
  const [mapping, setMapping] = React.useState<Connector | null>(null);
  const [syncing, setSyncing] = React.useState<string | null>(null);
  const [migrateOpen, setMigrateOpen] = React.useState(false);

  React.useEffect(() => {
    setConns(load());
    setHydrated(true);
  }, []);
  React.useEffect(() => {
    if (hydrated) persist(conns);
  }, [conns, hydrated]);

  const connected = CONNECTORS.filter((c) => conns[c.id]);
  const warehouse: DatasetVolume = connected.reduce(
    (acc, c) => {
      const r = conns[c.id].records;
      return {
        accounts: acc.accounts + r.accounts,
        journals: acc.journals + r.journals,
        invoices: acc.invoices + r.invoices,
        bills: acc.bills + r.bills,
        contacts: acc.contacts + r.contacts,
        orders: acc.orders + r.orders,
      };
    },
    { accounts: 0, journals: 0, invoices: 0, bills: 0, contacts: 0, orders: 0 },
  );
  const totalRows = totalRecords(warehouse);
  const lastSync = connected.map((c) => conns[c.id].lastSync).sort().slice(-1)[0];

  function connect(connectorId: string, account: string, env: string) {
    const c = connectorById(connectorId)!;
    setConns((prev) => ({
      ...prev,
      [connectorId]: { connectorId, account, env, connectedAt: nowIso(), lastSync: nowIso(), records: c.sample },
    }));
    setConnecting(null);
    runSync(connectorId);
  }
  function runSync(connectorId: string) {
    setSyncing(connectorId);
    window.setTimeout(() => {
      setConns((prev) =>
        prev[connectorId] ? { ...prev, [connectorId]: { ...prev[connectorId], lastSync: nowIso() } } : prev,
      );
      setSyncing((s) => (s === connectorId ? null : s));
    }, 900);
  }
  function disconnect(connectorId: string) {
    setConns((prev) => {
      const next = { ...prev };
      delete next[connectorId];
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Connections"
        subtitle="Connect the accounting systems you already run — NEXA ingests their ledgers into one warehouse that powers every report."
        actions={
          <Badge variant="primary" className="h-7 px-3">
            <Database className="size-3.5" /> {connected.length}/{CONNECTORS.length} sources
          </Badge>
        }
      />

      {/* Migrate from Tally — the headline switch-over for Indian SMEs */}
      <Card className="mb-4 flex flex-wrap items-center gap-4 border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ArrowRightLeft className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Migrate from Tally in an afternoon</p>
          <p className="text-sm text-muted-foreground">
            Pull your full ledgers, masters, vouchers and GST history straight from Tally — no CSV gymnastics, opening
            balances tied out to the rupee.
          </p>
        </div>
        <Button onClick={() => setMigrateOpen(true)} className="shrink-0">
          <ArrowRightLeft className="size-4" /> Migrate from Tally
        </Button>
      </Card>

      {/* Warehouse summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Connected sources" value={String(connected.length)} icon={Plug} />
        <Stat label="Rows in warehouse" value={compact(totalRows)} icon={Layers} />
        <Stat label="Live datasets" value={connected.length ? String(DATASETS.length) : "0"} icon={Database} />
        <Stat label="Last sync" value={lastSync ? fmtWhen(lastSync) : "—"} icon={RefreshCw} />
      </div>

      {/* Unified warehouse → datasets → reports (the BI layer) */}
      <Card className="mb-6 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <p className="text-sm font-semibold">Unified data warehouse</p>
          <span className="text-xs text-muted-foreground">source ledgers → one model → your reports</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {DATASETS.map((d) => {
            const count = warehouse[d.from as keyof DatasetVolume];
            return (
              <div key={d.id} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-sm font-medium">{d.name}</p>
                <p className="mt-0.5 text-lg font-bold tabular">{count ? compact(count) : "—"}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ArrowRight className="size-3" /> {d.powers}
                </p>
              </div>
            );
          })}
        </div>
        {connected.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            No sources connected yet — connect one below and NEXA will populate these datasets automatically.
          </p>
        )}
      </Card>

      {/* Connectors */}
      <p className="mb-2 text-sm font-semibold">Available connectors</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONNECTORS.map((c) => {
          const conn = conns[c.id];
          const isSyncing = syncing === c.id;
          return (
            <Card key={c.id} className="flex flex-col p-4">
              <div className="flex items-start gap-3">
                <Monogram c={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold leading-tight">{c.name}</p>
                    {conn && (
                      <Badge variant="success" className="gap-1">
                        <Check className="size-3" /> Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.vendor} · {c.category}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.blurb}</p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5" /> {c.authType} · {c.region}
              </p>

              {conn ? (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg border bg-muted/20 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{conn.account}</span>
                      <span className="text-muted-foreground">{fmtWhen(conn.lastSync)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                      {conn.records.orders > 0 && (
                        <span><b className="text-foreground tabular">{compact(conn.records.orders)}</b> orders</span>
                      )}
                      {conn.records.journals > 0 && (
                        <span><b className="text-foreground tabular">{compact(conn.records.journals)}</b> journals</span>
                      )}
                      <span><b className="text-foreground tabular">{compact(conn.records.invoices)}</b> invoices</span>
                      {conn.records.accounts > 0 && (
                        <span><b className="text-foreground tabular">{compact(conn.records.accounts)}</b> accounts</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => runSync(c.id)} disabled={isSyncing}>
                      {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      {isSyncing ? "Syncing…" : "Sync now"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMapping(c)} title="Configure mapping">
                      <Settings2 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => disconnect(c.id)} title="Disconnect">
                      <Unplug className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button className="mt-3 w-full" onClick={() => setConnecting(c)}>
                  <Plug className="size-4" /> Connect
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <ConnectModal connector={connecting} onClose={() => setConnecting(null)} onConnect={connect} />
      <MappingDrawer connector={mapping} onClose={() => setMapping(null)} />
      <MigrationDrawer open={migrateOpen} onClose={() => setMigrateOpen(false)} />
    </>
  );
}

function MigrationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = React.useState<"idle" | "running" | "done">("idle");
  const [done, setDone] = React.useState(0);
  const timer = React.useRef<number | null>(null);

  // Reset whenever the drawer is opened.
  React.useEffect(() => {
    if (open) { setPhase("idle"); setDone(0); }
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [open]);

  function start() {
    setPhase("running");
    setDone(0);
    timer.current = window.setInterval(() => {
      setDone((d) => {
        const next = d + 1;
        if (next >= TALLY_MIGRATION.length) {
          if (timer.current) window.clearInterval(timer.current);
          setPhase("done");
        }
        return next;
      });
    }, 650);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title={<span className="flex items-center gap-2"><ArrowRightLeft className="size-4 text-primary" /> Migrate from Tally</span>}
      subtitle="Read-only import — your Tally company is never modified"
    >
      <div className="space-y-4">
        {phase === "done" && (
          <Card className="flex items-start gap-3 border-success/30 bg-success/5 p-4">
            <PartyPopper className="mt-0.5 size-5 shrink-0 text-success" />
            <div>
              <p className="font-semibold text-success">Migration complete</p>
              <p className="text-sm text-muted-foreground">
                Imported {MIGRATION_RESULT.ledgers.toLocaleString("en-IN")} ledgers, {MIGRATION_RESULT.parties.toLocaleString("en-IN")} parties and{" "}
                {MIGRATION_RESULT.vouchers.toLocaleString("en-IN")} vouchers ({MIGRATION_RESULT.fyRange}). Opening balances tie out to Tally.
              </p>
            </div>
          </Card>
        )}

        <ol className="space-y-2">
          {TALLY_MIGRATION.map((step, i) => {
            const complete = i < done;
            const active = phase === "running" && i === done;
            return (
              <li key={step.key} className={cn("flex items-start gap-3 rounded-lg border p-3", active && "border-primary/40 bg-primary/5")}>
                <span className="mt-0.5 shrink-0">
                  {complete ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/40" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{step.label}</p>
                    <span className={cn("text-xs tabular", complete ? "text-success" : "text-muted-foreground")}>{step.count}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex justify-end gap-2 border-t pt-3">
          {phase === "done" ? (
            <Button onClick={onClose}><Check className="size-4" /> Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={phase === "running"}>Cancel</Button>
              <Button onClick={start} disabled={phase === "running"}>
                {phase === "running" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-4" />}
                {phase === "running" ? "Migrating…" : "Start migration"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function Monogram({ c }: { c: Connector }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
      style={{ backgroundColor: c.color }}
    >
      {c.monogram}
    </span>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Plug }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular">{value}</p>
    </Card>
  );
}

function ConnectModal({
  connector, onClose, onConnect,
}: {
  connector: Connector | null;
  onClose: () => void;
  onConnect: (id: string, account: string, env: string) => void;
}) {
  const [account, setAccount] = React.useState("");
  const [env, setEnv] = React.useState("Production");
  const [secret, setSecret] = React.useState("");

  React.useEffect(() => {
    if (connector) { setAccount(""); setEnv("Production"); setSecret(""); }
  }, [connector]);

  if (!connector) return null;
  const ready = account.trim() && secret.trim();
  return (
    <Modal
      open={!!connector}
      onClose={onClose}
      className="max-w-lg"
      title={<span className="flex items-center gap-2"><Monogram c={connector} /> Connect {connector.name}</span>}
      description={`${connector.authType} · NEXA reads your ledgers; it never writes back to ${connector.vendor}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready} onClick={() => onConnect(connector.id, account.trim(), env)}>
            <ShieldCheck className="size-4" /> Test &amp; connect
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Company / organisation</Label>
          <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. Nexa Foods Pvt Ltd" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Environment</Label>
            <Select value={env} onChange={(e) => setEnv(e.target.value)} className="mt-1">
              <option>Production</option>
              <option>Sandbox</option>
            </Select>
          </div>
          <div>
            <Label>{connector.authType.includes("Company") ? "Auth token" : connector.authType.includes("API") ? "API token" : "Client secret"}</Label>
            <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="••••••••••••" className="mt-1" />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          On connect, NEXA performs a read-only initial sync of accounts, journals, invoices, bills and contacts,
          then keeps the warehouse in step on a schedule.
        </div>
      </div>
    </Modal>
  );
}

function MappingDrawer({ connector, onClose }: { connector: Connector | null; onClose: () => void }) {
  return (
    <Drawer
      open={!!connector}
      onClose={onClose}
      title={connector ? `${connector.name} — field mapping` : "Mapping"}
      subtitle="How the source chart of accounts maps onto NEXA"
      width="max-w-lg"
    >
      {connector && (
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Datasets ingested</p>
            <div className="flex flex-wrap gap-1.5">
              {DATASETS.map((d) => (
                <Badge key={d.id} variant="success" className="gap-1"><CheckCircle2 className="size-3" /> {d.name}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Account mapping (sample)</p>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{connector.name}</th>
                    <th className="px-3 py-2 font-medium">NEXA account</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_MAPPING.map((m) => (
                    <tr key={m.code} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2">{m.source}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-muted-foreground">{m.code}</span> {m.nexa}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Unmapped accounts are auto-matched by name &amp; code on first sync; you can override any mapping here.
          </p>
        </div>
      )}
    </Drawer>
  );
}

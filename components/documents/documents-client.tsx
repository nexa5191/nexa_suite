"use client";

import * as React from "react";
import {
  Cloud,
  HardDrive,
  Database,
  FolderOpen,
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  Link2,
  Check,
  Plug,
  RefreshCw,
  Search,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProviderId = "microsoft" | "google" | "dropbox" | "s3";

interface SourceDef {
  key: string;
  label: string;
  provider: ProviderId;
}

interface ProviderDef {
  id: ProviderId;
  name: string;
  sub: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string; // brand tile colour
  account: string; // shown once connected
  alwaysOn?: boolean; // server-side store, no OAuth
  sources: SourceDef[];
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "microsoft",
    name: "Microsoft",
    sub: "OneDrive + SharePoint",
    Icon: Cloud,
    accent: "#0078D4",
    account: "finance@nexa.example",
    sources: [
      { key: "onedrive", label: "OneDrive", provider: "microsoft" },
      { key: "sharepoint", label: "SharePoint", provider: "microsoft" },
    ],
  },
  {
    id: "google",
    name: "Google",
    sub: "Google Drive",
    Icon: HardDrive,
    accent: "#1A73E8",
    account: "records@nexa.example",
    sources: [{ key: "gdrive", label: "Google Drive", provider: "google" }],
  },
  {
    id: "dropbox",
    name: "Dropbox",
    sub: "Dropbox Business",
    Icon: Folder,
    accent: "#0061FF",
    account: "nexa-group",
    sources: [{ key: "dropbox", label: "Dropbox", provider: "dropbox" }],
  },
  {
    id: "s3",
    name: "S3 Files",
    sub: "Server Files",
    Icon: Database,
    accent: "#F59E0B",
    account: "s3://nexa-fin-docs",
    alwaysOn: true,
    sources: [{ key: "s3", label: "S3 / Local", provider: "s3" }],
  },
];

interface MockFile {
  name: string;
  kind: "folder" | "pdf" | "doc" | "sheet" | "image" | "file";
  size?: string;
  modified: string;
}

const FILES: Record<string, MockFile[]> = {
  onedrive: [
    { name: "Invoices", kind: "folder", modified: "2 days ago" },
    { name: "Vendor Contracts", kind: "folder", modified: "1 week ago" },
    { name: "FY25-26 Statutory Audit Report.pdf", kind: "pdf", size: "1.8 MB", modified: "Yesterday" },
    { name: "Board Resolution – Capex.docx", kind: "doc", size: "92 KB", modified: "3 weeks ago" },
  ],
  sharepoint: [
    { name: "Compliance", kind: "folder", modified: "5 days ago" },
    { name: "Payroll Register June.xlsx", kind: "sheet", size: "164 KB", modified: "Today" },
    { name: "GSTR-3B Workings Q1.xlsx", kind: "sheet", size: "120 KB", modified: "2 days ago" },
    { name: "Group SOP – Procurement.pdf", kind: "pdf", size: "1.2 MB", modified: "1 month ago" },
  ],
  gdrive: [
    { name: "Bank Statements", kind: "folder", modified: "Today" },
    { name: "Tax Filings", kind: "folder", modified: "4 days ago" },
    { name: "Bank – HDFC May 2026.pdf", kind: "pdf", size: "310 KB", modified: "Yesterday" },
    { name: "TDS Reconciliation.xlsx", kind: "sheet", size: "57 KB", modified: "6 days ago" },
    { name: "Vendor Contract – Sterling Foods.pdf", kind: "pdf", size: "640 KB", modified: "2 weeks ago" },
  ],
  dropbox: [
    { name: "Brand", kind: "folder", modified: "1 week ago" },
    { name: "Investor Updates", kind: "folder", modified: "3 days ago" },
    { name: "Annual Report 2026.pdf", kind: "pdf", size: "5.4 MB", modified: "2 weeks ago" },
    { name: "Cap Table.xlsx", kind: "sheet", size: "48 KB", modified: "1 month ago" },
  ],
  s3: [
    { name: "ledger-backups", kind: "folder", modified: "Automated" },
    { name: "scanned-bills", kind: "folder", modified: "Today" },
    { name: "nexa-db-2026-06-04.bak", kind: "file", size: "62 MB", modified: "Today" },
    { name: "PO-4821-signed.png", kind: "image", size: "740 KB", modified: "Yesterday" },
  ],
};

const FILE_ICON: Record<MockFile["kind"], React.ComponentType<{ className?: string }>> = {
  folder: Folder,
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  image: FileImage,
  file: FileIcon,
};

const FILE_TINT: Record<MockFile["kind"], string> = {
  folder: "text-primary",
  pdf: "text-danger",
  doc: "text-primary",
  sheet: "text-success",
  image: "text-warning",
  file: "text-muted-foreground",
};

type FileRowData = MockFile & { sourceLabel: string; provider: ProviderDef };

function FileRow({ file, showSource }: { file: FileRowData; showSource?: boolean }) {
  const Icon = FILE_ICON[file.kind];
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent/50">
      <Icon className={cn("size-4 shrink-0", FILE_TINT[file.kind])} />
      <span className="flex-1 truncate">{file.name}</span>
      {showSource && (
        <span className="hidden items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline-flex">
          <file.provider.Icon className="size-3" />
          {file.sourceLabel}
        </span>
      )}
      <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{file.size ?? "—"}</span>
      <span className="w-24 text-right text-xs text-muted-foreground">{file.modified}</span>
    </li>
  );
}

const STORAGE_KEY = "nexa-integrations";

export function DocumentsClient() {
  const [connected, setConnected] = React.useState<Record<ProviderId, boolean>>({
    microsoft: false,
    google: true,
    dropbox: false,
    s3: true,
  });
  const [active, setActive] = React.useState<string>("gdrive");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConnected((c) => ({ ...c, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: Record<ProviderId, boolean>) => {
    setConnected(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const providerOf = (sourceKey: string) =>
    PROVIDERS.find((p) => p.sources.some((s) => s.key === sourceKey))!;

  const toggle = (id: ProviderId) => {
    const p = PROVIDERS.find((x) => x.id === id)!;
    if (p.alwaysOn) return;
    persist({ ...connected, [id]: !connected[id] });
  };

  const activeProvider = providerOf(active);
  const activeConnected = connected[activeProvider.id];
  const allSources = PROVIDERS.flatMap((p) => p.sources);

  const q = query.trim().toLowerCase();
  const universal = q.length > 0; // a query searches every connected source at once
  const connectedSources = allSources.filter((s) => connected[providerOf(s.key).id]);

  type Row = MockFile & { sourceKey: string; sourceLabel: string; provider: ProviderDef };
  const rows: Row[] = universal
    ? connectedSources.flatMap((s) =>
        (FILES[s.key] ?? [])
          .filter((f) => f.name.toLowerCase().includes(q))
          .map((f) => ({ ...f, sourceKey: s.key, sourceLabel: s.label, provider: providerOf(s.key) })),
      )
    : activeConnected
      ? (FILES[active] ?? []).map((f) => ({
          ...f,
          sourceKey: active,
          sourceLabel: activeProvider.sources.find((s) => s.key === active)?.label ?? activeProvider.name,
          provider: activeProvider,
        }))
      : [];

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Connect cloud storage and search every source from one place."
      />

      <div className="space-y-6">
        {/* Provider connection cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PROVIDERS.map((p) => {
            const on = connected[p.id];
            return (
              <Card key={p.id} className={cn("p-3", on && "ring-1 ring-success/40")}>
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ background: p.accent }}
                  >
                    <p.Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{on ? p.account : p.sub}</p>
                  </div>
                  {on ? (
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                      title="Connected"
                    >
                      <Check className="size-4" />
                    </span>
                  ) : null}
                </div>

                <div className="mt-3">
                  {on ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setActive(p.sources[0].key)}>
                        <FolderOpen className="size-3.5" /> Browse
                      </Button>
                      {!p.alwaysOn && (
                        <Button variant="ghost" size="sm" onClick={() => toggle(p.id)} title="Disconnect">
                          <Link2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => toggle(p.id)}>
                      <Plug className="size-4" /> Connect
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* File browser */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
            {/* source rail */}
            <div className="border-b bg-muted/30 p-3 md:border-b-0 md:border-r">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sources
              </p>
              <div className="space-y-0.5">
                {allSources.map((s) => {
                  const prov = providerOf(s.key);
                  const isOn = connected[prov.id];
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActive(s.key)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active === s.key
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <prov.Icon className="size-4 shrink-0" />
                        {s.label}
                      </span>
                      {isOn ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <ChevronRight className="size-3.5 opacity-40" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* file list */}
            <div className="min-h-[320px] p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search all connected documents…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" title="Refresh" disabled={!activeConnected && !universal}>
                  <RefreshCw className="size-4" />
                </Button>
              </div>

              {universal && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Search className="size-3.5" />
                  {rows.length} result{rows.length !== 1 ? "s" : ""} across {connectedSources.length} connected source
                  {connectedSources.length !== 1 ? "s" : ""}
                </p>
              )}

              {universal ? (
                connectedSources.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    Connect a source above to search documents.
                  </p>
                ) : rows.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No documents match “{query}”.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {rows.map((f) => (
                      <FileRow key={`${f.sourceKey}-${f.name}`} file={f} showSource />
                    ))}
                  </ul>
                )
              ) : !activeConnected ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <span
                    className="flex size-12 items-center justify-center rounded-xl text-white"
                    style={{ background: activeProvider.accent }}
                  >
                    <activeProvider.Icon className="size-6" />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Connect {activeProvider.name} to list and attach files.
                  </p>
                  <Button onClick={() => toggle(activeProvider.id)}>
                    <Plug className="size-4" /> Connect {activeProvider.name}
                  </Button>
                </div>
              ) : (
                <ul className="divide-y rounded-md border">
                  {rows.map((f) => (
                    <FileRow key={f.name} file={f} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

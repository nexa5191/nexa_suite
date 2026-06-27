"use client";

import { useMemo, useState } from "react";
import { Briefcase, MapPin, Send, CheckCircle2, Wallet, Building2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { useRecruitment } from "@/components/recruitment/recruitment-provider";
import { locationById } from "@/lib/accounting/org";
import { departmentName } from "@/lib/hr/employees";
import {
  AGENCIES,
  OPENINGS,
  agencyById,
  commissionAmount,
  openingById,
  type Opening,
  type CandidateStage,
} from "@/lib/recruitment";
import { cn, formatDate } from "@/lib/utils";

const STAGE_TONE: Record<CandidateStage, "default" | "primary" | "warning" | "success" | "danger"> = {
  new: "default",
  screening: "default",
  shortlisted: "primary",
  interview: "warning",
  offer: "success",
  hired: "success",
  archived: "danger",
};

const blankForm = (role = "") => ({
  name: "",
  email: "",
  phone: "",
  currentCompany: "",
  location: "",
  desiredRole: role,
  skills: "",
  experienceYears: "",
  noticePeriodDays: "",
  expectedCtcLakh: "",
});

export function AgencyPortalClient() {
  const { candidates, submit } = useRecruitment();
  const [agencyId, setAgencyId] = useState(AGENCIES[0]?.id ?? "");
  const [target, setTarget] = useState<Opening | null>(null);
  const [form, setForm] = useState(blankForm());
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  const agency = agencyById(agencyId);
  const openRoles = OPENINGS.filter((o) => o.status === "open");

  const mine = useMemo(() => candidates.filter((c) => c.agencyId === agencyId), [candidates, agencyId]);
  const earned = mine.filter((c) => c.stage === "hired").reduce((s, c) => s + commissionAmount(c.expectedCtcLakh, agency), 0);
  const pipeline = mine
    .filter((c) => c.stage !== "hired" && c.stage !== "archived")
    .reduce((s, c) => s + commissionAmount(c.expectedCtcLakh, agency), 0);

  function openFor(o: Opening) {
    setTarget(o);
    setForm(blankForm(o.title));
  }
  const set = (patch: Partial<ReturnType<typeof blankForm>>) => setForm((f) => ({ ...f, ...patch }));

  const valid =
    form.name.trim() && form.email.trim() && form.desiredRole.trim() && Number(form.expectedCtcLakh) > 0;

  function handleSubmit() {
    if (!valid) return;
    const c = submit({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      desiredRole: form.desiredRole.trim(),
      currentCompany: form.currentCompany.trim(),
      location: form.location.trim(),
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      experienceYears: Number(form.experienceYears) || 0,
      noticePeriodDays: Number(form.noticePeriodDays) || 0,
      expectedCtcLakh: Number(form.expectedCtcLakh) || 0,
      openingId: target?.id ?? null,
      agencyId,
    });
    setTarget(null);
    setJustSubmitted(c.name);
    setTimeout(() => setJustSubmitted(null), 4000);
  }

  return (
    <>
      <PageHeader
        title="Agency Portal"
        subtitle="Partner self-service — submit candidates against open roles and track your commissions."
        actions={
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <Select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="h-9 w-56">
              {AGENCIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {justSubmitted && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success/8 p-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> Submitted <span className="font-medium">{justSubmitted}</span> — the hiring team will review the CV.
        </div>
      )}

      {/* Commission summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Commission rate</p>
          <p className="mt-0.5 text-lg font-bold">{agency?.commissionPct}% <span className="text-xs font-normal text-muted-foreground">of annual CTC</span></p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="size-3.5" /> Earned (hired)</p>
          <p className="mt-0.5 text-lg font-bold text-success tabular"><Money value={earned} /></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">In pipeline (potential)</p>
          <p className="mt-0.5 text-lg font-bold tabular"><Money value={pipeline} /></p>
        </Card>
      </div>

      {/* Open roles */}
      <p className="mb-2 text-sm font-semibold">Open roles ({openRoles.length})</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {openRoles.map((o) => (
          <Card key={o.id} className="flex flex-col p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold leading-tight">{o.title}</p>
                <p className="text-xs text-muted-foreground">{departmentName(o.departmentId)}</p>
              </div>
              <Badge variant="success">open</Badge>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {locationById(o.locationId)?.name}</p>
              <p className="flex items-center gap-1.5"><Briefcase className="size-3.5" /> {o.positions} position{o.positions === 1 ? "" : "s"} · {o.type}</p>
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => openFor(o)}>
              <Send className="size-4" /> Submit candidate
            </Button>
          </Card>
        ))}
      </div>

      {/* My submissions */}
      <p className="mb-2 text-sm font-semibold">Your submissions ({mine.length})</p>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Candidate</th>
              <th className="px-3 py-2.5 font-medium">Role / Opening</th>
              <th className="px-3 py-2.5 text-right font-medium">Exp</th>
              <th className="px-3 py-2.5 text-right font-medium">CTC</th>
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-3 py-2.5 text-right font-medium">Commission</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((c) => {
              const comm = commissionAmount(c.expectedCtcLakh, agency);
              const op = openingById(c.openingId);
              return (
                <tr key={c.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.currentCompany || "—"}</p>
                  </td>
                  <td className="px-3 py-2">{op ? op.title : c.desiredRole}</td>
                  <td className="px-3 py-2 text-right tabular">{c.experienceYears}y</td>
                  <td className="px-3 py-2 text-right tabular">₹{c.expectedCtcLakh}L</td>
                  <td className="px-3 py-2">
                    <Badge variant={STAGE_TONE[c.stage]} className="capitalize">{c.stage}</Badge>
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular", c.stage === "hired" ? "font-semibold text-success" : "text-muted-foreground")}>
                    <Money value={comm} /> {c.stage === "hired" ? "" : <span className="text-[11px]">(est.)</span>}
                  </td>
                </tr>
              );
            })}
            {mine.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No submissions yet — pick an open role above to submit your first candidate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Submit modal */}
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        className="max-w-2xl"
        title={target ? `Submit candidate — ${target.title}` : "Submit candidate"}
        description={agency ? `Submitting as ${agency.name} · ${agency.commissionPct}% commission on hire` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!valid}>
              <Send className="size-4" /> Submit CV
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Full name</Label>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Candidate name" className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Desired role</Label>
            <Input value={form.desiredRole} onChange={(e) => set({ desiredRole: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Current company</Label>
            <Input value={form.currentCompany} onChange={(e) => set({ currentCompany: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => set({ location: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Experience (years)</Label>
            <Input type="number" min={0} value={form.experienceYears} onChange={(e) => set({ experienceYears: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Notice (days)</Label>
            <Input type="number" min={0} value={form.noticePeriodDays} onChange={(e) => set({ noticePeriodDays: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Expected CTC (₹ lakh)</Label>
            <Input type="number" min={0} value={form.expectedCtcLakh} onChange={(e) => set({ expectedCtcLakh: e.target.value })} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label>Skills (comma-separated)</Label>
            <Input value={form.skills} onChange={(e) => set({ skills: e.target.value })} placeholder="e.g. GST, Tally, SAP FICO" className="mt-1" />
          </div>
        </div>
      </Modal>
    </>
  );
}

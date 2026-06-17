import { CalendarDays, Banknote, FileText, type LucideIcon } from "lucide-react";
import type { ApprovalKind } from "@/lib/hr/types";

// Shared presentation for the three approval kinds — used by both the
// dashboard widget and the full /approvals page.
export const KIND_META: Record<
  ApprovalKind,
  { label: string; Icon: LucideIcon; tone: "primary" | "warning" | "default" }
> = {
  leave: { label: "Leave", Icon: CalendarDays, tone: "primary" },
  financial: { label: "Invoices & POs", Icon: Banknote, tone: "warning" },
  document: { label: "Documents & others", Icon: FileText, tone: "default" },
};

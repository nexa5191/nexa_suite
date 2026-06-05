import { ApprovalsClient } from "@/components/hr/approvals-client";
import { allApprovals } from "@/lib/hr/approvals";

export const metadata = { title: "Approvals — NEXA" };

export default function ApprovalsPage() {
  // Built on the server from the deterministic data layer; client handles decisions.
  return <ApprovalsClient approvals={allApprovals()} />;
}

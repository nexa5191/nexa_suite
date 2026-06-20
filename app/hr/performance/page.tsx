import type { Metadata } from "next";
import { PerformanceClient } from "@/components/hr/performance-client";

export const metadata: Metadata = { title: "Performance & OKRs — NEXA" };

export default function PerformancePage() {
  return <PerformanceClient />;
}

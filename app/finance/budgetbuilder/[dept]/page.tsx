import { notFound } from "next/navigation";
import { deptFromSlug } from "@/lib/finance/budget-builder";
import { BudgetDeptClient } from "@/components/finance/budget-dept-client";

export function generateMetadata({ params }: { params: { dept: string } }) {
  const dept = deptFromSlug(params.dept);
  return { title: dept ? `${dept} Budget — NEXA` : "Budget Builder — NEXA" };
}

export default function BudgetDeptPage({ params }: { params: { dept: string } }) {
  const dept = deptFromSlug(params.dept);
  if (!dept) notFound();
  return <BudgetDeptClient dept={dept} />;
}

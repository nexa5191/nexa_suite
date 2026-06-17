"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { NewJournalEntry } from "./new-journal-entry";
import type { VoucherType } from "@/lib/accounting/manual-entries";

/**
 * A drop-in button that opens the voucher form preset to a given type. Lets each
 * module surface the entry kinds that belong to it (Sales in Invoicing, Purchase
 * in Vendors, Contra/Payment/Receipt in Banking, …).
 */
export function VoucherButton({
  type,
  label,
  lockType = true,
  variant,
  size,
  className,
}: {
  type: VoucherType;
  label: string;
  /** Lock to this type (true) or let the user switch types in the form (false). */
  lockType?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </Button>
      <NewJournalEntry open={open} onClose={() => setOpen(false)} defaultType={type} lockType={lockType} title={label} />
    </>
  );
}

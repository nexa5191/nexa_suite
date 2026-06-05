import { PageHeader } from "@/components/shell/page-header";
import { InvoiceBuilder } from "@/components/invoicing/invoice-builder";

export const metadata = { title: "New invoice — NEXA" };

export default function NewInvoicePage() {
  return (
    <>
      <PageHeader
        title="New invoice"
        subtitle="Build a GST invoice with a live preview. Override the bill-to without touching the CRM record."
      />
      <InvoiceBuilder />
    </>
  );
}

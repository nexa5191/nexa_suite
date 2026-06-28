import { VendorPortalClient } from "@/components/vendors/vendor-portal-client";

export const metadata = { title: "Vendor Portal — NEXA" };

// Read the portal token from the URL (?v=base64token) and pass it to the client
// so the vendor is auto-logged-in when they follow their unique portal link.
export default function VendorPortalPage({
  searchParams,
}: {
  searchParams: { v?: string; new?: string };
}) {
  return (
    <VendorPortalClient
      tokenParam={searchParams.v ?? null}
      showOnboard={searchParams.new === "1"}
    />
  );
}

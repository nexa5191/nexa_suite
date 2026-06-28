// ---------------------------------------------------------------------------
// POST /api/gst/lookup  { gstin: string }
//
// Validates a GSTIN against the live gst.gov.in database via Appyflow.
// If GST_API_KEY is not set, falls back to format-only validation so the
// UI still works in dev without a key.
//
// Appyflow key setup:
//   1. Sign up at appyflow.in → Dashboard → API Keys → copy key_secret
//   2. Add to .env.local:  GST_API_KEY=your_key_secret
//   3. Restart dev server
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { validateGstinFormat } from "@/lib/gstin";

export interface GstLookupResponse {
  valid: boolean;
  gstin?: string;
  legalName?: string;
  tradeName?: string;
  status?: string;          // "ACTIVE" | "CANCELLED" | "SUSPENDED"
  registrationDate?: string;
  taxPayerType?: string;    // "Regular" | "Composition" | "SEZ" etc.
  stateCode?: string;
  stateName?: string;
  pan?: string;
  address?: string;
  source: "live" | "mock"; // "live" = real API hit, "mock" = format-only
  error?: string;
}

const API_KEY = process.env.GST_API_KEY ?? "";
// Appyflow GST verification endpoint
const APPYFLOW_BASE = "https://api.appyflow.in";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw: string = (body.gstin ?? "").trim().toUpperCase();

  // Always run local format check first — saves an API call for obvious typos.
  const fmt = validateGstinFormat(raw);
  if (!fmt.valid) {
    return NextResponse.json<GstLookupResponse>({
      valid: false,
      source: "mock",
      error: fmt.error,
    });
  }

  // No API key configured → return format-only result.
  if (!API_KEY) {
    return NextResponse.json<GstLookupResponse>({
      valid: true,
      gstin: fmt.gstin,
      stateCode: fmt.stateCode,
      stateName: fmt.stateName,
      pan: fmt.pan,
      source: "mock",
      legalName: undefined, // will be shown as "Format valid — live lookup not configured"
    });
  }

  // Live Appyflow lookup.
  try {
    const res = await fetch(`${APPYFLOW_BASE}/v2/getGSTDetails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ gstin: fmt.gstin }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json<GstLookupResponse>({
        valid: true,              // format is valid even if lookup fails
        gstin: fmt.gstin,
        stateCode: fmt.stateCode,
        stateName: fmt.stateName,
        pan: fmt.pan,
        source: "mock",
        error: `API error ${res.status}: ${text.slice(0, 120)}`,
      });
    }

    const data = await res.json();
    // Appyflow response shape: { success, data: { legalName, tradeName, status, ... } }
    const d = data?.data ?? data;

    return NextResponse.json<GstLookupResponse>({
      valid: true,
      gstin: fmt.gstin,
      legalName: d.legalName ?? d.legal_name ?? d.taxpayerName,
      tradeName: d.tradeName ?? d.trade_name ?? d.tradeNam,
      status: d.status ?? d.sts,
      registrationDate: d.registrationDate ?? d.rgdt,
      taxPayerType: d.taxPayerType ?? d.dty,
      stateCode: fmt.stateCode,
      stateName: fmt.stateName,
      pan: fmt.pan,
      address: [d.addressLine1, d.addressLine2, d.city, d.pincode].filter(Boolean).join(", "),
      source: "live",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<GstLookupResponse>({
      valid: true,
      gstin: fmt.gstin,
      stateCode: fmt.stateCode,
      stateName: fmt.stateName,
      pan: fmt.pan,
      source: "mock",
      error: `Lookup failed: ${msg}`,
    });
  }
}

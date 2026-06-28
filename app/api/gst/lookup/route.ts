// ---------------------------------------------------------------------------
// POST /api/gst/lookup  { gstin: string }
//
// Validates a GSTIN in three tiers:
//   1. Direct hit to gst.gov.in public taxpayer-search API (no auth needed —
//      same endpoint the GST portal website uses for unauthenticated search).
//      CORS blocks browser→gst.gov.in, but this route runs server-side.
//   2. Appyflow wrapper (fallback if GST portal is unreachable / rate-limited).
//      Requires GST_API_KEY in .env.local.
//   3. Format-only mock (offline fallback — no live name/status data).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { validateGstinFormat } from "@/lib/gstin";

export interface GstLookupResponse {
  valid: boolean;
  gstin?: string;
  legalName?: string;
  tradeName?: string;
  status?: string;          // "Active" | "Cancelled" | "Suspended"
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

// gst.gov.in public taxpayer search — no key, no login required.
// Same endpoint the portal website hits for Search Taxpayer (unauthenticated).
const GST_PORTAL_URL =
  "https://services.gst.gov.in/services/api/search/taxpayerDetails";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw: string = (body.gstin ?? "").trim().toUpperCase();

  // Local format check first — no network call for obvious typos.
  const fmt = validateGstinFormat(raw);
  if (!fmt.valid) {
    return NextResponse.json<GstLookupResponse>({
      valid: false,
      source: "mock",
      error: fmt.error,
    });
  }

  // ── Tier 1: direct gst.gov.in ──────────────────────────────────────────
  try {
    const res = await fetch(`${GST_PORTAL_URL}?gstin=${fmt.gstin}`, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        // Mirror what a browser sends so gst.gov.in doesn't reject the request.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: "https://www.gst.gov.in/",
      },
      signal: AbortSignal.timeout(8000),
      // Next.js — don't cache GST lookups (data changes if registration status changes).
      cache: "no-store",
    });

    if (res.ok) {
      const d = await res.json();
      // gst.gov.in field names: lgnm=legalName, tradeNam=tradeName, sts=status,
      // rgdt=registrationDate, dty=taxpayerType, pradr.adr=address
      if (d && (d.lgnm || d.tradeNam)) {
        return NextResponse.json<GstLookupResponse>({
          valid: true,
          gstin: fmt.gstin,
          legalName: d.lgnm ?? d.tradeNam,
          tradeName: d.tradeNam,
          status: d.sts,
          registrationDate: d.rgdt,
          taxPayerType: d.dty,
          stateCode: fmt.stateCode,
          stateName: fmt.stateName,
          pan: fmt.pan,
          address: d.pradr?.adr ?? undefined,
          source: "live",
        });
      }
    }
    // Non-OK or empty response → fall through to tier 2 / tier 3.
  } catch {
    // Network error / timeout — fall through.
  }

  // ── Tier 2: Appyflow (if key configured) ────────────────────────────────
  if (API_KEY) {
    try {
      const res = await fetch("https://api.appyflow.in/v2/getGSTDetails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ gstin: fmt.gstin }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        const d = data?.data ?? data;
        if (d && (d.legalName || d.legal_name || d.taxpayerName)) {
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
            address: [d.addressLine1, d.addressLine2, d.city, d.pincode]
              .filter(Boolean)
              .join(", "),
            source: "live",
          });
        }
      }
    } catch {
      // Fall through to format-only.
    }
  }

  // ── Tier 3: format-only mock ─────────────────────────────────────────────
  return NextResponse.json<GstLookupResponse>({
    valid: true,
    gstin: fmt.gstin,
    stateCode: fmt.stateCode,
    stateName: fmt.stateName,
    pan: fmt.pan,
    source: "mock",
    error: API_KEY
      ? "Live lookup unavailable — format is valid"
      : "Live lookup unavailable — format is valid (set GST_API_KEY for live data)",
  });
}

// ---------------------------------------------------------------------------
// Vendor onboarding / self-registration.
//
// Vendors submit a registration form (at /vendor-portal?new=1) which is stored
// here as a "pending" registration. The AP team reviews and approves on the
// /vendors page — approval writes the vendor into nexa-added-vendors.
// ---------------------------------------------------------------------------

import type { VendorCategory, MsmeClass } from "@/lib/vendors";

export type OnboardingStatus = "pending" | "approved" | "rejected";

export interface VendorOnboarding {
  id: string;
  submittedAt: string;          // ISO datetime
  status: OnboardingStatus;
  reviewedAt?: string;
  reviewNote?: string;

  // Vendor details (filled by the vendor themselves)
  name: string;
  gstin: string;
  gstinLegalName?: string;      // fetched from GST API
  gstinStatus?: string;         // ACTIVE / CANCELLED
  gstinVerified: boolean;
  pan: string;

  contact: string;
  email: string;
  phone: string;
  city: string;
  state: string;

  category: VendorCategory;
  msme: boolean;
  msmeClass?: MsmeClass;
  udyam?: string;               // Udyam registration number

  bankName?: string;
  bankAccount?: string;
  ifsc?: string;
}

const KEY = "nexa-vendor-onboarding";

function read<T>(k: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fb;
}
function write<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}

export const loadOnboardings = (): VendorOnboarding[] =>
  read<VendorOnboarding[]>(KEY, []);

export const saveOnboardings = (list: VendorOnboarding[]) =>
  write(KEY, list);

export function submitOnboarding(
  data: Omit<VendorOnboarding, "id" | "submittedAt" | "status" | "gstinVerified">,
  gstinVerified: boolean,
): VendorOnboarding {
  const entry: VendorOnboarding = {
    ...data,
    id: `ob-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    status: "pending",
    gstinVerified,
  };
  const list = loadOnboardings();
  list.unshift(entry);
  saveOnboardings(list);
  return entry;
}

export function updateOnboardingStatus(
  id: string,
  status: OnboardingStatus,
  note?: string,
): void {
  const list = loadOnboardings().map((o) =>
    o.id === id
      ? { ...o, status, reviewedAt: new Date().toISOString(), reviewNote: note }
      : o,
  );
  saveOnboardings(list);
}

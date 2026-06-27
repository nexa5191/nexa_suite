export type ConsignmentType = "outbound" | "inbound";
export type ConsignmentStatus = "active" | "reconciling" | "closed";

export interface ConsignmentLocation {
  id: string;
  name: string;
  type: ConsignmentType;
  partyName: string;
  partyGstin: string;
  address: string;
  contactName: string;
  contactPhone: string;
  entityId: string;
  replenishmentFrequency: "weekly" | "fortnightly" | "monthly";
  lastReconciled: string | null;
  status: ConsignmentStatus;
}

export interface ConsignmentStock {
  id: string;
  locationId: string;
  itemName: string;
  hsn: string;
  uom: string;
  qtyPlaced: number;
  qtySold: number;
  qtyReturned: number;
  qtyOnHand: number;
  lastMovementDate: string;
  ratePerUnit: number;
  totalValueOnSite: number;
}

export interface ConsignmentMovement {
  id: string;
  ref: string;
  locationId: string;
  date: string;
  type: "dispatch" | "sale-report" | "return" | "reconciliation";
  itemName: string;
  qty: number;
  uom: string;
  remarks: string;
}

// ---- Seed data --------------------------------------------------------------
export const SEED_LOCATIONS: ConsignmentLocation[] = [];

export const SEED_STOCK: ConsignmentStock[] = [];

export const SEED_MOVEMENTS: ConsignmentMovement[] = [];

// ---- Persistence ------------------------------------------------------------
const LOC_KEY   = "nexa-csm-locations";
const STOCK_KEY = "nexa-csm-stock";
const MOV_KEY   = "nexa-csm-movements";

export function loadLocations(): ConsignmentLocation[] {
  if (typeof window === "undefined") return SEED_LOCATIONS;
  try {
    const s = localStorage.getItem(LOC_KEY);
    if (s) return JSON.parse(s) as ConsignmentLocation[];
  } catch {}
  return SEED_LOCATIONS;
}
export function saveLocations(locs: ConsignmentLocation[]) {
  try { localStorage.setItem(LOC_KEY, JSON.stringify(locs)); } catch {}
}

export function loadStock(): ConsignmentStock[] {
  if (typeof window === "undefined") return SEED_STOCK;
  try {
    const s = localStorage.getItem(STOCK_KEY);
    if (s) return JSON.parse(s) as ConsignmentStock[];
  } catch {}
  return SEED_STOCK;
}
export function saveStock(stock: ConsignmentStock[]) {
  try { localStorage.setItem(STOCK_KEY, JSON.stringify(stock)); } catch {}
}

export function loadMovements(): ConsignmentMovement[] {
  if (typeof window === "undefined") return SEED_MOVEMENTS;
  try {
    const s = localStorage.getItem(MOV_KEY);
    if (s) return JSON.parse(s) as ConsignmentMovement[];
  } catch {}
  return SEED_MOVEMENTS;
}
export function saveMovements(movs: ConsignmentMovement[]) {
  try { localStorage.setItem(MOV_KEY, JSON.stringify(movs)); } catch {}
}

// ---- Derived helpers --------------------------------------------------------
export function locationName(locs: ConsignmentLocation[], id: string): string {
  return locs.find((l) => l.id === id)?.name ?? id;
}

export function stockForLocation(stock: ConsignmentStock[], locationId: string): ConsignmentStock[] {
  return stock.filter((s) => s.locationId === locationId);
}

export function locationTotalValue(stock: ConsignmentStock[], locationId: string): number {
  return stockForLocation(stock, locationId).reduce((s, r) => s + r.totalValueOnSite, 0);
}

export function locationItemCount(stock: ConsignmentStock[], locationId: string): number {
  return stockForLocation(stock, locationId).filter((s) => s.qtyOnHand > 0).length;
}

export function nextMovementRef(movs: ConsignmentMovement[]): string {
  const nums = movs.map((m) => {
    const n = parseInt(m.ref.replace("CSM-", ""), 10);
    return isNaN(n) ? 0 : n;
  });
  const next = Math.max(0, ...nums) + 1;
  return `CSM-${String(next).padStart(3, "0")}`;
}

export const MOVEMENT_TYPE_LABELS: Record<ConsignmentMovement["type"], string> = {
  dispatch:        "Dispatch",
  "sale-report":   "Sale Report",
  return:          "Return",
  reconciliation:  "Reconciliation",
};

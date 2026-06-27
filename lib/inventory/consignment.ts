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
export const SEED_LOCATIONS: ConsignmentLocation[] = [
  {
    id: "csmloc-001",
    name: "BigBazaar – Koramangala",
    type: "outbound",
    partyName: "Future Retail Ltd",
    partyGstin: "29AABCF1234G1Z1",
    address: "Koramangala 4th Block, Bengaluru 560034",
    contactName: "Rajesh Kumar",
    contactPhone: "+91 98450 11234",
    entityId: "ent-nexa-in",
    replenishmentFrequency: "weekly",
    lastReconciled: "2026-06-15",
    status: "active",
  },
  {
    id: "csmloc-002",
    name: "DMart – Wakad Pune",
    type: "outbound",
    partyName: "Avenue Supermarts Ltd",
    partyGstin: "27AABCA1234H2Z2",
    address: "Wakad, Pune 411057",
    contactName: "Priya Sharma",
    contactPhone: "+91 98230 22345",
    entityId: "ent-nexa-pune",
    replenishmentFrequency: "weekly",
    lastReconciled: "2026-06-14",
    status: "active",
  },
  {
    id: "csmloc-003",
    name: "Metro Cash & Carry – Kukatpally",
    type: "outbound",
    partyName: "Metro Cash & Carry India Pvt Ltd",
    partyGstin: "36AABCM5678I3Z3",
    address: "Kukatpally, Hyderabad 500072",
    contactName: "Suresh Rao",
    contactPhone: "+91 98490 33456",
    entityId: "ent-nexa-hyd",
    replenishmentFrequency: "fortnightly",
    lastReconciled: "2026-06-10",
    status: "active",
  },
  {
    id: "csmloc-004",
    name: "Nilgiris Distribution – Electronic City",
    type: "outbound",
    partyName: "Nilgiris Dairy Farm Ltd",
    partyGstin: "29AABCN9012J4Z4",
    address: "Electronic City Phase 1, Bengaluru 560100",
    contactName: "Anitha Nair",
    contactPhone: "+91 98440 44567",
    entityId: "ent-nexa-in",
    replenishmentFrequency: "fortnightly",
    lastReconciled: "2026-05-31",
    status: "reconciling",
  },
  {
    id: "csmloc-005",
    name: "FreshKart Online – Dark Store BLR",
    type: "outbound",
    partyName: "FreshKart Technologies Pvt Ltd",
    partyGstin: "29AABCF3456K5Z5",
    address: "Whitefield, Bengaluru 560066",
    contactName: "Deepak Singh",
    contactPhone: "+91 98770 55678",
    entityId: "ent-nexa-in",
    replenishmentFrequency: "weekly",
    lastReconciled: "2026-06-20",
    status: "active",
  },
  {
    id: "csmloc-006",
    name: "Gopala Packaging – Peenya",
    type: "inbound",
    partyName: "Gopala Packaging Industries",
    partyGstin: "29AABCG7890L6Z6",
    address: "Peenya Industrial Area, Bengaluru 560058",
    contactName: "Murali Krishnan",
    contactPhone: "+91 98450 66789",
    entityId: "ent-nexa-in",
    replenishmentFrequency: "monthly",
    lastReconciled: "2026-06-01",
    status: "active",
  },
];

export const SEED_STOCK: ConsignmentStock[] = [
  // BigBazaar Koramangala
  {
    id: "csmstk-001", locationId: "csmloc-001",
    itemName: "Wheat Flour 1 kg", hsn: "1101", uom: "pcs",
    qtyPlaced: 2400, qtySold: 1850, qtyReturned: 0, qtyOnHand: 550,
    lastMovementDate: "2026-06-22", ratePerUnit: 45, totalValueOnSite: 24750,
  },
  {
    id: "csmstk-002", locationId: "csmloc-001",
    itemName: "Ready Mix Spice Blend 50 g", hsn: "2103", uom: "pcs",
    qtyPlaced: 6000, qtySold: 4800, qtyReturned: 120, qtyOnHand: 1080,
    lastMovementDate: "2026-06-22", ratePerUnit: 12, totalValueOnSite: 12960,
  },
  // DMart Pune
  {
    id: "csmstk-003", locationId: "csmloc-002",
    itemName: "Wheat Flour 1 kg", hsn: "1101", uom: "pcs",
    qtyPlaced: 1800, qtySold: 1420, qtyReturned: 0, qtyOnHand: 380,
    lastMovementDate: "2026-06-21", ratePerUnit: 45, totalValueOnSite: 17100,
  },
  {
    id: "csmstk-004", locationId: "csmloc-002",
    itemName: "Refined Sunflower Oil 1 L", hsn: "1512", uom: "pcs",
    qtyPlaced: 960, qtySold: 720, qtyReturned: 0, qtyOnHand: 240,
    lastMovementDate: "2026-06-21", ratePerUnit: 135, totalValueOnSite: 32400,
  },
  // Metro Hyderabad
  {
    id: "csmstk-005", locationId: "csmloc-003",
    itemName: "Wheat Flour 5 kg", hsn: "1101", uom: "pcs",
    qtyPlaced: 480, qtySold: 350, qtyReturned: 10, qtyOnHand: 120,
    lastMovementDate: "2026-06-18", ratePerUnit: 210, totalValueOnSite: 25200,
  },
  {
    id: "csmstk-006", locationId: "csmloc-003",
    itemName: "Cumin Powder 100 g", hsn: "0909", uom: "pcs",
    qtyPlaced: 3000, qtySold: 2200, qtyReturned: 0, qtyOnHand: 800,
    lastMovementDate: "2026-06-18", ratePerUnit: 18, totalValueOnSite: 14400,
  },
  // Nilgiris Distribution
  {
    id: "csmstk-007", locationId: "csmloc-004",
    itemName: "Coriander Powder 100 g", hsn: "0909", uom: "pcs",
    qtyPlaced: 2400, qtySold: 1600, qtyReturned: 50, qtyOnHand: 750,
    lastMovementDate: "2026-06-12", ratePerUnit: 15, totalValueOnSite: 11250,
  },
  {
    id: "csmstk-008", locationId: "csmloc-004",
    itemName: "Ready Mix Spice Blend 100 g", hsn: "2103", uom: "pcs",
    qtyPlaced: 1800, qtySold: 1200, qtyReturned: 0, qtyOnHand: 600,
    lastMovementDate: "2026-06-12", ratePerUnit: 22, totalValueOnSite: 13200,
  },
  // FreshKart Online
  {
    id: "csmstk-009", locationId: "csmloc-005",
    itemName: "Wheat Flour 1 kg", hsn: "1101", uom: "pcs",
    qtyPlaced: 1200, qtySold: 980, qtyReturned: 0, qtyOnHand: 220,
    lastMovementDate: "2026-06-25", ratePerUnit: 45, totalValueOnSite: 9900,
  },
  {
    id: "csmstk-010", locationId: "csmloc-005",
    itemName: "Refined Sunflower Oil 500 ml", hsn: "1512", uom: "pcs",
    qtyPlaced: 600, qtySold: 480, qtyReturned: 0, qtyOnHand: 120,
    lastMovementDate: "2026-06-25", ratePerUnit: 72, totalValueOnSite: 8640,
  },
  // Gopala Packaging (inbound vendor)
  {
    id: "csmstk-011", locationId: "csmloc-006",
    itemName: "HDPE Laminated Bags 1 kg", hsn: "3923", uom: "pcs",
    qtyPlaced: 150000, qtySold: 92000, qtyReturned: 0, qtyOnHand: 58000,
    lastMovementDate: "2026-06-20", ratePerUnit: 3.5, totalValueOnSite: 203000,
  },
];

export const SEED_MOVEMENTS: ConsignmentMovement[] = [
  { id: "csmmov-001", ref: "CSM-001", locationId: "csmloc-001", date: "2026-05-01", type: "dispatch",      itemName: "Wheat Flour 1 kg",           qty: 1200, uom: "pcs", remarks: "Initial replenishment — May cycle" },
  { id: "csmmov-002", ref: "CSM-002", locationId: "csmloc-001", date: "2026-05-01", type: "dispatch",      itemName: "Ready Mix Spice Blend 50 g",  qty: 3000, uom: "pcs", remarks: "Initial replenishment — May cycle" },
  { id: "csmmov-003", ref: "CSM-003", locationId: "csmloc-001", date: "2026-05-15", type: "sale-report",   itemName: "Wheat Flour 1 kg",           qty: 950,  uom: "pcs", remarks: "Fortnightly sale report from BigBazaar" },
  { id: "csmmov-004", ref: "CSM-004", locationId: "csmloc-001", date: "2026-05-15", type: "sale-report",   itemName: "Ready Mix Spice Blend 50 g",  qty: 2400, uom: "pcs", remarks: "Fortnightly sale report from BigBazaar" },
  { id: "csmmov-005", ref: "CSM-005", locationId: "csmloc-002", date: "2026-05-05", type: "dispatch",      itemName: "Wheat Flour 1 kg",           qty: 900,  uom: "pcs", remarks: "Weekly replenishment — DMart Pune" },
  { id: "csmmov-006", ref: "CSM-006", locationId: "csmloc-002", date: "2026-05-05", type: "dispatch",      itemName: "Refined Sunflower Oil 1 L",  qty: 480,  uom: "pcs", remarks: "Weekly replenishment — DMart Pune" },
  { id: "csmmov-007", ref: "CSM-007", locationId: "csmloc-002", date: "2026-05-20", type: "sale-report",   itemName: "Wheat Flour 1 kg",           qty: 710,  uom: "pcs", remarks: "Monthly sale report — DMart Pune" },
  { id: "csmmov-008", ref: "CSM-008", locationId: "csmloc-002", date: "2026-05-20", type: "sale-report",   itemName: "Refined Sunflower Oil 1 L",  qty: 360,  uom: "pcs", remarks: "Monthly sale report — DMart Pune" },
  { id: "csmmov-009", ref: "CSM-009", locationId: "csmloc-003", date: "2026-05-10", type: "dispatch",      itemName: "Wheat Flour 5 kg",           qty: 240,  uom: "pcs", remarks: "Fortnightly dispatch — Metro Hyderabad" },
  { id: "csmmov-010", ref: "CSM-010", locationId: "csmloc-003", date: "2026-05-10", type: "dispatch",      itemName: "Cumin Powder 100 g",         qty: 1500, uom: "pcs", remarks: "Fortnightly dispatch — Metro Hyderabad" },
  { id: "csmmov-011", ref: "CSM-011", locationId: "csmloc-003", date: "2026-05-25", type: "sale-report",   itemName: "Wheat Flour 5 kg",           qty: 175,  uom: "pcs", remarks: "Metro Hyderabad — May sale confirmation" },
  { id: "csmmov-012", ref: "CSM-012", locationId: "csmloc-001", date: "2026-05-28", type: "return",        itemName: "Ready Mix Spice Blend 50 g",  qty: 120,  uom: "pcs", remarks: "Near-expiry stock returned by BigBazaar" },
  { id: "csmmov-013", ref: "CSM-013", locationId: "csmloc-005", date: "2026-06-01", type: "dispatch",      itemName: "Wheat Flour 1 kg",           qty: 600,  uom: "pcs", remarks: "FreshKart dark store — June stock" },
  { id: "csmmov-014", ref: "CSM-014", locationId: "csmloc-005", date: "2026-06-01", type: "dispatch",      itemName: "Refined Sunflower Oil 500 ml", qty: 300, uom: "pcs", remarks: "FreshKart dark store — June stock" },
  { id: "csmmov-015", ref: "CSM-015", locationId: "csmloc-004", date: "2026-05-08", type: "dispatch",      itemName: "Ready Mix Spice Blend 100 g", qty: 900, uom: "pcs", remarks: "Nilgiris fortnightly dispatch" },
  { id: "csmmov-016", ref: "CSM-016", locationId: "csmloc-004", date: "2026-05-31", type: "reconciliation", itemName: "Coriander Powder 100 g",    qty: 750,  uom: "pcs", remarks: "May end reconciliation — actual count matches" },
  { id: "csmmov-017", ref: "CSM-017", locationId: "csmloc-006", date: "2026-06-01", type: "dispatch",      itemName: "HDPE Laminated Bags 1 kg",   qty: 75000, uom: "pcs", remarks: "Gopala Packaging VMI replenishment — June lot" },
  { id: "csmmov-018", ref: "CSM-018", locationId: "csmloc-006", date: "2026-06-20", type: "sale-report",   itemName: "HDPE Laminated Bags 1 kg",   qty: 46000, uom: "pcs", remarks: "Nexa consumption report — invoicing trigger to Gopala" },
];

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

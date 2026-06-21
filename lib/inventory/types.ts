// ---------------------------------------------------------------------------
// NEXA inventory domain model — a manufacturing stock system for Nexa Foods.
//
// Material flows:  Raw materials ─▶ Semi-finished (WIP) ─▶ Finished goods,
// with Packing materials consumed at the finishing stage. Everything moves
// through one signed stock-movement ledger, so current stock is always the sum
// of an item's movements at a location.
// ---------------------------------------------------------------------------

export type ItemCategory = "raw" | "packing" | "semi-finished" | "finished";

export type Uom = "kg" | "L" | "pcs";

// How a producible item is manufactured / sourced:
//  • own           — made in our own plant (RM + packing + our conversion)
//  • loan-license  — made at a licensee's facility under our licence; we bear
//                    material + a per-unit job-work / loan-licence charge
//  • third-party   — bought in as finished goods from a contract manufacturer
export type OwnershipModel = "own" | "loan-license" | "third-party";

export interface Item {
  id: string;
  code: string;
  name: string;
  category: ItemCategory;
  uom: Uom; // base unit of measure (BUoM) — stock is always held in this
  rate: number; // standard valuation rate, base INR per UoM
  hsn: string;
  reorderLevel: number; // group-wide reorder point, in UoM
  primaryLocationId: string; // where it is mainly held / produced
  // Optional alternative / purchase unit (e.g. a case or bag) — can be added
  // later. `altPack` = how many base units one alternative unit contains.
  altUom?: string;
  altPack?: number;
  shelfLifeDays?: number;
  ownership?: OwnershipModel; // producible items; defaults to "own"
  conversionRate?: number; // ₹/unit conversion (own factory) or job-work (loan-license)
  buyRate?: number; // ₹/unit landed purchase cost for third-party finished goods
  manufacturer?: string; // loan-licensee / third-party supplier name
  // Supply-chain planning parameters
  leadTimeDays?: number; // supplier / production lead time in calendar days
  safetyDays?: number;   // days of buffer stock above lead-time demand
}

export interface BomComponent {
  itemId: string;
  qtyPerUnit: number; // input UoM consumed to make ONE unit of the output item
}

export type MovementType =
  | "opening" // opening balance
  | "receipt" // goods received (e.g. against a vendor PO)
  | "production" // output of a production run (+)
  | "consumption" // inputs consumed by a production run (−)
  | "transfer-in" // inter-location transfer (+)
  | "transfer-out" // inter-location transfer (−)
  | "sale" // dispatched against a sales invoice (−)
  | "adjustment"; // stock-take / write-off (±)

export interface Movement {
  id: string;
  date: string; // ISO
  itemId: string;
  locationId: string;
  type: MovementType;
  qty: number; // SIGNED, in the item's UoM (+ in, − out) — the ACTUAL quantity
  stdQty?: number; // SIGNED standard quantity (BOM-allowed) — for production/consumption
  ref?: string; // PO / production / invoice / transfer reference
  note?: string;
  byId?: string; // employee
  batchNo?: string; // lot / batch number (perishable & traceable items)
  expiry?: string; // ISO expiry / best-before date for this batch
}

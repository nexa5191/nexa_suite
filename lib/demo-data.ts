// lib/demo-data.ts
// ---------------------------------------------------------------------------
// Demo dataset — a self-consistent set of master data across all modules.
// Call loadDemoData() to write everything to localStorage then reload.
// ---------------------------------------------------------------------------
import type { Entity, Location } from "@/lib/accounting/types";
import type { Item, BomComponent } from "@/lib/inventory/types";
import type { Vendor } from "@/lib/vendors";
import type { CrmAccount, CrmContact } from "@/lib/crm";
import type { Employee } from "@/lib/hr/types";
import type { BankAccount } from "@/lib/banking/banking";

const DEMO_ENTITIES: Entity[] = [
  { id: "ent-1", name: "Acme Foods Pvt Ltd",   legalName: "Acme Foods Private Limited",   currency: "INR", country: "India", gstin: "29AABCA1234E1Z5" },
  { id: "ent-2", name: "Acme Trading Pvt Ltd", legalName: "Acme Trading Private Limited", currency: "INR", country: "India", gstin: "27AABCA5678F1Z2" },
];

const DEMO_LOCATIONS: Location[] = [
  { id: "loc-1", entityId: "ent-1", name: "Bengaluru HQ",  city: "Bengaluru", state: "Karnataka",    stateCode: "29" },
  { id: "loc-2", entityId: "ent-2", name: "Mumbai Depot",  city: "Mumbai",    state: "Maharashtra",  stateCode: "27" },
];

const DEMO_ITEMS: Item[] = [
  { id: "item-001", code: "RM-001", name: "Wheat Grain",           category: "raw",      uom: "kg",  rate: 22,  hsn: "1001", reorderLevel: 500, primaryLocationId: "loc-1" },
  { id: "item-002", code: "RM-002", name: "Rice Paddy",            category: "raw",      uom: "kg",  rate: 28,  hsn: "1006", reorderLevel: 300, primaryLocationId: "loc-1" },
  { id: "item-003", code: "PM-001", name: "BOPP Film Roll",        category: "packing",  uom: "kg",  rate: 145, hsn: "3920", reorderLevel: 100, primaryLocationId: "loc-1" },
  { id: "item-004", code: "PM-002", name: "Carton Box (24-unit)",  category: "packing",  uom: "pcs", rate: 18,  hsn: "4819", reorderLevel: 200, primaryLocationId: "loc-1" },
  { id: "item-005", code: "FG-001", name: "Wheat Flour 1kg",       category: "finished", uom: "pcs", rate: 45,  hsn: "1101", reorderLevel: 200, primaryLocationId: "loc-1", ownership: "own", conversionRate: 8 },
  { id: "item-006", code: "FG-002", name: "Rice Flour 500g",       category: "finished", uom: "pcs", rate: 38,  hsn: "1102", reorderLevel: 150, primaryLocationId: "loc-1", ownership: "own", conversionRate: 7 },
  { id: "item-007", code: "FG-003", name: "Multi-Grain Mix 1kg",   category: "finished", uom: "pcs", rate: 95,  hsn: "1102", reorderLevel: 100, primaryLocationId: "loc-1", ownership: "own", conversionRate: 12 },
  { id: "item-008", code: "FG-004", name: "Semolina Fine 500g",    category: "finished", uom: "pcs", rate: 40,  hsn: "1103", reorderLevel: 120, primaryLocationId: "loc-1", ownership: "own", conversionRate: 7 },
];

const DEMO_BOM: Record<string, BomComponent[]> = {
  "item-005": [{ itemId: "item-001", qtyPerUnit: 1.05 }, { itemId: "item-003", qtyPerUnit: 0.025 }],
  "item-006": [{ itemId: "item-002", qtyPerUnit: 0.55 }, { itemId: "item-003", qtyPerUnit: 0.015 }],
  "item-007": [{ itemId: "item-001", qtyPerUnit: 0.50 }, { itemId: "item-002", qtyPerUnit: 0.30 }, { itemId: "item-003", qtyPerUnit: 0.020 }],
  "item-008": [{ itemId: "item-001", qtyPerUnit: 0.52 }, { itemId: "item-003", qtyPerUnit: 0.015 }],
};

const DEMO_VENDORS: Vendor[] = [
  { id: "ven-1", name: "Sterling Grains Pvt Ltd", category: "Raw Materials",  vClass: "Inventory", contact: "Ramesh Joshi",   email: "procurement@sterlinggrains.in", phone: "+91 98765 43210", city: "Pune",      gstin: "27AABCS1234G1Z3", rating: 4, msme: false, active: true },
  { id: "ven-2", name: "BlueOcean Packaging",     category: "Packaging",      vClass: "Inventory", contact: "Anita Singh",    email: "sales@blueocean.in",            phone: "+91 98765 43211", city: "Bengaluru", gstin: "29AABCB5678H1Z1", rating: 4, msme: true, msmeClass: "Small", active: true },
  { id: "ven-3", name: "Swift Logistics",         category: "Logistics",      vClass: "Opex",      contact: "Vijay Kumar",    email: "ops@swiftlogistics.in",         phone: "+91 98765 43212", city: "Bengaluru", gstin: "29AABCS9012I1Z8", rating: 3, msme: false, active: true },
  { id: "ven-4", name: "TechSoft Solutions",      category: "IT & Software",  vClass: "Opex",      contact: "Pradeep Menon",  email: "sales@techsoft.in",             phone: "+91 98765 43213", city: "Hyderabad", gstin: "36AABCT3456J1Z5", rating: 5, msme: true, msmeClass: "Micro", active: true },
  { id: "ven-5", name: "Prime Office Spaces",     category: "Services",       vClass: "Opex",      contact: "Kavya Reddy",    email: "leasing@primeoffice.in",        phone: "+91 98765 43214", city: "Bengaluru", gstin: "29AABCP7890K1Z2", rating: 4, msme: false, active: true },
];

const DEMO_ACCOUNTS: CrmAccount[] = [
  { id: "acc-1", name: "FreshMart Retail",  legalName: "FreshMart Retail Pvt Ltd",         industry: "Retail Chain",   gstin: "29AABCF1234L1Z9", address: "14 MG Road",            city: "Bengaluru", state: "Karnataka",   stateCode: "29", email: "purchase@freshmart.in",    phone: "+91 80 1234 5678", website: "freshmart.in",   ownerId: "emp-2", entityId: "ent-1", stage: "won",         dealValue: 2400000, since: "2025-04-01" },
  { id: "acc-2", name: "BlueMart Stores",   legalName: "BlueMart Stores Ltd",               industry: "Retail Chain",   gstin: "27AABCB5678M1Z3", address: "22 Linking Road",       city: "Mumbai",    state: "Maharashtra", stateCode: "27", email: "buying@bluemart.in",       phone: "+91 22 2345 6789", website: "bluemart.in",    ownerId: "emp-2", entityId: "ent-2", stage: "won",         dealValue: 1800000, since: "2025-05-01" },
  { id: "acc-3", name: "QuickKart",         legalName: "QuickKart Commerce Pvt Ltd",        industry: "Quick Commerce", gstin: "06AABCQ9012N1Z2", address: "Tower 5, Cyber City",   city: "Gurugram",  state: "Haryana",     stateCode: "06", email: "vendor@quickkart.in",      phone: "+91 11 3456 7890", website: "quickkart.in",   ownerId: "emp-2", entityId: "ent-1", stage: "negotiation", dealValue: 3600000, since: "2025-06-01" },
  { id: "acc-4", name: "Green Basket",      legalName: "Green Basket Foods Pvt Ltd",        industry: "E-commerce",     gstin: "33AABCG3456O1Z1", address: "7 Anna Salai",          city: "Chennai",   state: "Tamil Nadu",  stateCode: "33", email: "supply@greenbasket.in",    phone: "+91 44 4567 8901", website: "greenbasket.in", ownerId: "emp-2", entityId: "ent-1", stage: "proposal",    dealValue: 900000,  since: "2025-09-01" },
  { id: "acc-5", name: "Metro Wholesale",   legalName: "Metro Cash & Carry India Pvt Ltd",  industry: "Distribution",   gstin: "36AABCM7890P1Z4", address: "Survey No. 240",        city: "Hyderabad", state: "Telangana",   stateCode: "36", email: "procurement@metro.in",     phone: "+91 40 5678 9012", website: "metro.in",       ownerId: "emp-2", entityId: "ent-2", stage: "won",         dealValue: 4800000, since: "2025-03-01" },
];

const DEMO_CONTACTS: CrmContact[] = [];

const DEMO_EMPLOYEES: Employee[] = [
  { id: "emp-1", code: "EMP-001", name: "Asha Menon",    email: "asha.menon@acme.example",    personalEmail: "asha.menon@gmail.com",    designation: "Chief Financial Officer",  departmentId: "dep-fin",  entityId: "ent-1", locationId: "loc-1", managerId: null,    joinDate: "2022-04-01", employmentType: "full-time", status: "active" },
  { id: "emp-2", code: "EMP-002", name: "Ravi Kapoor",   email: "ravi.kapoor@acme.example",   personalEmail: "ravi.kapoor@gmail.com",   designation: "Sales Manager",            departmentId: "dep-sal",  entityId: "ent-1", locationId: "loc-1", managerId: "emp-1", joinDate: "2022-07-01", employmentType: "full-time", status: "active" },
  { id: "emp-3", code: "EMP-003", name: "Priya Nair",    email: "priya.nair@acme.example",    personalEmail: "priya.nair@gmail.com",    designation: "HR Manager",               departmentId: "dep-hr",   entityId: "ent-1", locationId: "loc-1", managerId: "emp-1", joinDate: "2023-01-15", employmentType: "full-time", status: "active" },
  { id: "emp-4", code: "EMP-004", name: "Arjun Sharma",  email: "arjun.sharma@acme.example",  personalEmail: "arjun.sharma@gmail.com",  designation: "Production Head",          departmentId: "dep-ops",  entityId: "ent-1", locationId: "loc-1", managerId: "emp-1", joinDate: "2022-10-01", employmentType: "full-time", status: "active" },
  { id: "emp-5", code: "EMP-005", name: "Meera Iyer",    email: "meera.iyer@acme.example",    personalEmail: "meera.iyer@gmail.com",    designation: "Senior Accountant",        departmentId: "dep-fin",  entityId: "ent-1", locationId: "loc-1", managerId: "emp-1", joinDate: "2023-06-01", employmentType: "full-time", status: "active" },
  { id: "emp-6", code: "EMP-006", name: "Kiran Patel",   email: "kiran.patel@acme.example",   personalEmail: "kiran.patel@gmail.com",   designation: "Procurement Manager",      departmentId: "dep-proc", entityId: "ent-2", locationId: "loc-2", managerId: "emp-1", joinDate: "2023-03-01", employmentType: "full-time", status: "active" },
];

const DEMO_BANK_ACCOUNTS: BankAccount[] = [
  { id: "bank-1", entityId: "ent-1", accountCode: "1020", bankName: "HDFC Bank",  number: "5011 2233 4455", ifsc: "HDFC0001234", currency: "INR", opening: 1500000 },
  { id: "bank-2", entityId: "ent-2", accountCode: "1020", bankName: "ICICI Bank", number: "6022 7788 1122", ifsc: "ICIC0005678", currency: "INR", opening:  800000 },
];

/** Human-readable list of what gets loaded. */
export const DEMO_MODULES = [
  "2 entities + 2 locations",
  "8 inventory items + BOM",
  "5 vendors",
  "5 CRM accounts",
  "6 employees",
  "2 bank accounts",
];

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Write all demo master data to localStorage then reload the page. */
export function loadDemoData() {
  if (typeof window === "undefined") return;
  write("nexa-entities",      DEMO_ENTITIES);
  write("nexa-locations",     DEMO_LOCATIONS);
  write("nexa-items",         DEMO_ITEMS);
  write("nexa-bom",           DEMO_BOM);
  write("nexa-vendors",       DEMO_VENDORS);
  write("nexa-crm-accounts",  DEMO_ACCOUNTS);
  write("nexa-crm-contacts",  DEMO_CONTACTS);
  write("nexa-employees",     DEMO_EMPLOYEES);
  write("nexa-bank-accounts", DEMO_BANK_ACCOUNTS);
  window.location.reload();
}

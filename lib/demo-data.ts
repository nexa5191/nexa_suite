// lib/demo-data.ts
// ---------------------------------------------------------------------------
// COMPREHENSIVE DEMO DATASET v2
// Nexa Foods Group — FMCG manufacturer (spices, atta, rice, oils, condiments)
// 3 entities · 8 locations · 25 vendors · 140 items + BOMs · 100 employees
// 75 CRM accounts · 3 banks · Jan–Jun 2026 transaction history
// ---------------------------------------------------------------------------
import type { Entity, Location } from "@/lib/accounting/types";
import type { Item, BomComponent, Movement } from "@/lib/inventory/types";
import type { TransferOrder } from "@/lib/inventory/transfers";
import type { GoodsReceiptNote } from "@/lib/inventory/supply-chain";
import type { Vendor, PurchaseOrder } from "@/lib/vendors";
import type { CrmAccount, CrmContact, JourneyEvent } from "@/lib/crm";
import type { Employee } from "@/lib/hr/types";
import type { BankAccount } from "@/lib/banking/banking";
import type { ManualEntry } from "@/lib/accounting/manual-entries";
import type { Invoice } from "@/lib/invoicing";
import type { FixedAsset } from "@/lib/assets/assets";
import type { Loan } from "@/lib/hr/loans";

// ── helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number, w = 3) => String(n).padStart(w, "0");
function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── ENTITIES ─────────────────────────────────────────────────────────────────
const DEMO_ENTITIES: Entity[] = [
  { id: "ent-1", name: "Nexa Foods Pvt Ltd",        legalName: "Nexa Foods Private Limited",              currency: "INR", country: "India", gstin: "29AACN1001P1ZA" },
  { id: "ent-2", name: "Nexa Trading Pvt Ltd",      legalName: "Nexa Trading Private Limited",            currency: "INR", country: "India", gstin: "27AACN1002Q1ZB" },
  { id: "ent-3", name: "Nexa Agro Exports Pvt Ltd", legalName: "Nexa Agro Exports Private Limited",       currency: "INR", country: "India", gstin: "07AACN1003R1ZC" },
];

// ── LOCATIONS (3 parent + 5 child) ───────────────────────────────────────────
const DEMO_LOCATIONS: Location[] = [
  { id: "loc-1", entityId: "ent-1", name: "Bengaluru Manufacturing Plant", city: "Bengaluru",  state: "Karnataka",    stateCode: "29" },
  { id: "loc-2", entityId: "ent-2", name: "Mumbai Distribution Centre",    city: "Mumbai",     state: "Maharashtra",  stateCode: "27" },
  { id: "loc-3", entityId: "ent-3", name: "Delhi Export Hub",              city: "New Delhi",  state: "Delhi",        stateCode: "07" },
  { id: "loc-4", entityId: "ent-1", name: "Pune Production Unit",          city: "Pune",       state: "Maharashtra",  stateCode: "27" },
  { id: "loc-5", entityId: "ent-2", name: "Chennai Regional Depot",        city: "Chennai",    state: "Tamil Nadu",   stateCode: "33" },
  { id: "loc-6", entityId: "ent-2", name: "Hyderabad Depot",               city: "Hyderabad",  state: "Telangana",    stateCode: "36" },
  { id: "loc-7", entityId: "ent-3", name: "Kolkata Distribution Centre",   city: "Kolkata",    state: "West Bengal",  stateCode: "19" },
  { id: "loc-8", entityId: "ent-1", name: "Ahmedabad Packaging Hub",       city: "Ahmedabad",  state: "Gujarat",      stateCode: "24" },
];

// ── VENDORS (25) ─────────────────────────────────────────────────────────────
const DEMO_VENDORS: Vendor[] = [
  // Inventory — Raw Materials (6)
  { id: "ven-01", name: "Sterling Grains Pvt Ltd",     category: "Raw Materials",     vClass: "Inventory", contact: "Ramesh Joshi",    email: "procurement@sterlinggrains.in",  phone: "+91 98765 43210", city: "Pune",       gstin: "27AABCS1234G1Z3", rating: 4, msme: true,  msmeClass: "Small",  active: true },
  { id: "ven-02", name: "Pioneer Seeds & Agro",        category: "Raw Materials",     vClass: "Inventory", contact: "Bharat Desai",    email: "sales@pioneerseeds.in",          phone: "+91 97654 32109", city: "Nagpur",     gstin: "27AABCP2345H1Z2", rating: 4, msme: true,  msmeClass: "Micro",  active: true },
  { id: "ven-03", name: "Vishnu Agro Traders",         category: "Raw Materials",     vClass: "Inventory", contact: "Suresh Patil",    email: "info@vishnuagro.in",             phone: "+91 96543 21098", city: "Kolhapur",   gstin: "27AABCV3456I1Z1", rating: 3, msme: true,  msmeClass: "Small",  active: true },
  { id: "ven-04", name: "Nature's Best Organics",      category: "Raw Materials",     vClass: "Inventory", contact: "Ananya Kulkarni", email: "supply@naturesbestorganics.in",  phone: "+91 95432 10987", city: "Nashik",     gstin: "27AABCN4567J1Z9", rating: 5, msme: false,               active: true },
  { id: "ven-05", name: "Sunrise Spice Traders",       category: "Raw Materials",     vClass: "Inventory", contact: "Mohan Nair",      email: "sales@sunrisespice.in",          phone: "+91 94321 09876", city: "Kochi",      gstin: "32AABCS5678K1Z8", rating: 4, msme: true,  msmeClass: "Small",  active: true },
  { id: "ven-06", name: "Aromatic Herbs Co",           category: "Raw Materials",     vClass: "Inventory", contact: "Lakshmi Devi",    email: "export@aromaticherbs.in",        phone: "+91 93210 98765", city: "Guntur",     gstin: "37AABCA6789L1Z7", rating: 4, msme: true,  msmeClass: "Micro",  active: true },
  // Inventory — Packaging (4)
  { id: "ven-07", name: "BlueOcean Packaging",         category: "Packaging",         vClass: "Inventory", contact: "Anita Singh",     email: "sales@blueocean.in",             phone: "+91 92109 87654", city: "Bengaluru",  gstin: "29AABCB7890M1Z6", rating: 4, msme: true,  msmeClass: "Small",  active: true },
  { id: "ven-08", name: "Flex Pack India Pvt Ltd",     category: "Packaging",         vClass: "Inventory", contact: "Dinesh Shah",     email: "info@flexpack.in",               phone: "+91 91098 76543", city: "Ahmedabad",  gstin: "24AABCF8901N1Z5", rating: 5, msme: false,               active: true },
  { id: "ven-09", name: "SkyPack Solutions",           category: "Packaging",         vClass: "Inventory", contact: "Ritu Sharma",     email: "orders@skypack.in",              phone: "+91 90987 65432", city: "Mumbai",     gstin: "27AABCS9012O1Z4", rating: 4, msme: false,               active: true },
  { id: "ven-10", name: "PrintMasters Labels",         category: "Packaging",         vClass: "Inventory", contact: "Ajay Kapoor",     email: "print@printmasters.in",          phone: "+91 89876 54321", city: "Delhi",      gstin: "07AABCP0123P1Z3", rating: 3, msme: true,  msmeClass: "Small",  active: true },
  // Opex — Logistics (3)
  { id: "ven-11", name: "Swift Logistics Pvt Ltd",     category: "Logistics",         vClass: "Opex",      contact: "Vijay Kumar",     email: "ops@swiftlogistics.in",          phone: "+91 88765 43210", city: "Bengaluru",  gstin: "29AABCS1235Q1Z2", rating: 3, msme: false,               active: true },
  { id: "ven-12", name: "BlueDart Express Ltd",        category: "Logistics",         vClass: "Opex",      contact: "Prateek Roy",     email: "enterprise@bluedart.in",         phone: "+91 87654 32109", city: "Mumbai",     gstin: "27AABCB2346R1Z1", rating: 5, msme: false,               active: true },
  { id: "ven-13", name: "Reliable Road Transport",     category: "Logistics",         vClass: "Opex",      contact: "Harpal Singh",    email: "dispatch@reliabletransport.in",  phone: "+91 86543 21098", city: "Delhi",      gstin: "07AABCR3457S1Z9", rating: 3, msme: true,  msmeClass: "Micro",  active: true },
  // Opex — IT & Software (2)
  { id: "ven-14", name: "TechSoft Solutions",          category: "IT & Software",     vClass: "Opex",      contact: "Pradeep Menon",   email: "sales@techsoft.in",              phone: "+91 85432 10987", city: "Hyderabad",  gstin: "36AABCT4568T1Z8", rating: 5, msme: true,  msmeClass: "Micro",  active: true },
  { id: "ven-15", name: "CloudBase Systems Pvt Ltd",   category: "IT & Software",     vClass: "Opex",      contact: "Sneha Iyer",      email: "accounts@cloudbase.in",          phone: "+91 84321 09876", city: "Bengaluru",  gstin: "29AABCC5679U1Z7", rating: 4, msme: true,  msmeClass: "Micro",  active: true },
  // Opex — Marketing (2)
  { id: "ven-16", name: "BrandWave Agency",            category: "Marketing",         vClass: "Opex",      contact: "Neha Arora",      email: "hello@brandwave.in",             phone: "+91 83210 98765", city: "Mumbai",     gstin: "27AABCB6780V1Z6", rating: 4, msme: false,               active: true },
  { id: "ven-17", name: "DigitalReach Media",          category: "Marketing",         vClass: "Opex",      contact: "Rohan Mehta",     email: "sales@digitalreach.in",          phone: "+91 82109 87654", city: "Delhi",      gstin: "07AABCD7891W1Z5", rating: 4, msme: true,  msmeClass: "Small",  active: true },
  // Opex — Services (3)
  { id: "ven-18", name: "Prime Office Spaces",         category: "Services",          vClass: "Opex",      contact: "Kavya Reddy",     email: "leasing@primeoffice.in",         phone: "+91 81098 76543", city: "Bengaluru",  gstin: "29AABCP8902X1Z4", rating: 4, msme: false,               active: true },
  { id: "ven-19", name: "Clean Pro Facility Mgmt",     category: "Services",          vClass: "Opex",      contact: "Joseph Thomas",   email: "contracts@cleanpro.in",          phone: "+91 80987 65432", city: "Mumbai",     gstin: "27AABCC9013Y1Z3", rating: 3, msme: true,  msmeClass: "Small",  active: true },
  { id: "ven-20", name: "Security Shield India",       category: "Services",          vClass: "Opex",      contact: "Gurpreet Singh",  email: "ops@securityshield.in",          phone: "+91 79876 54321", city: "Delhi",      gstin: "07AABCS0124Z1Z2", rating: 3, msme: false,               active: true },
  // Capex — Capital Equipment (2)
  { id: "ven-21", name: "Robopack Industries",         category: "Capital Equipment", vClass: "Capex",     contact: "Venkat Subramanian", email: "sales@robopack.in",            phone: "+91 78765 43210", city: "Coimbatore", gstin: "33AABCR1235A1Z1", rating: 5, msme: true,  msmeClass: "Small",  active: true },
  { id: "ven-22", name: "Maize Engineering Works",     category: "Capital Equipment", vClass: "Capex",     contact: "Dilip Panchal",   email: "info@maizeengineering.in",       phone: "+91 77654 32109", city: "Pune",       gstin: "27AABCM2346B1Z9", rating: 4, msme: false,               active: true },
  // Capex — Office Equipment (2)
  { id: "ven-23", name: "Officespace Furnishers",      category: "Office Equipment",  vClass: "Capex",     contact: "Meena Prabhu",    email: "sales@officespacefurnishers.in", phone: "+91 76543 21098", city: "Bengaluru",  gstin: "29AABCO3457C1Z8", rating: 4, msme: true,  msmeClass: "Micro",  active: true },
  { id: "ven-24", name: "Canon India Ltd",             category: "Office Equipment",  vClass: "Capex",     contact: "Arun Varghese",   email: "b2b@canon.in",                   phone: "+91 75432 10987", city: "Gurugram",   gstin: "06AABCC4568D1Z7", rating: 5, msme: false,               active: true },
  // Employee Claims (1)
  { id: "ven-25", name: "Employee Reimbursements",     category: "Employee Claims",   vClass: "Employee",  contact: "HR Department",   email: "hr@nexafoods.example",           phone: "+91 74321 09876", city: "Bengaluru",  gstin: "29AACN1001P1ZA", rating: 5, msme: false,               active: true },
];

// ── ITEMS (140) ───────────────────────────────────────────────────────────────
type IS = [string,string,string,Item["category"],Item["uom"],number,string,number,string];
const ii = ([id,code,name,category,uom,rate,hsn,rl,loc]: IS, extra?: Partial<Item>): Item =>
  ({ id, code, name, category, uom, rate, hsn, reorderLevel: rl, primaryLocationId: loc, ...extra });

const DEMO_ITEMS: Item[] = [
  // ── Raw Materials (40) ───────────────────────────────────────────────────
  // Grains (10)
  ii(["rm-001","RM-001","Wheat Grain",         "raw","kg", 22,  "1001",2000,"loc-1"]),
  ii(["rm-002","RM-002","Rice Paddy",           "raw","kg", 28,  "1006",1500,"loc-1"]),
  ii(["rm-003","RM-003","Jowar (Sorghum)",      "raw","kg", 18,  "1007", 800,"loc-1"]),
  ii(["rm-004","RM-004","Bajra (Pearl Millet)", "raw","kg", 16,  "1008", 600,"loc-4"]),
  ii(["rm-005","RM-005","Ragi (Finger Millet)", "raw","kg", 35,  "1008", 500,"loc-1"]),
  ii(["rm-006","RM-006","Maize / Corn",         "raw","kg", 20,  "1005",1200,"loc-4"]),
  ii(["rm-007","RM-007","Oats",                 "raw","kg", 55,  "1004", 400,"loc-1"]),
  ii(["rm-008","RM-008","Barley",               "raw","kg", 24,  "1003", 300,"loc-1"]),
  ii(["rm-009","RM-009","Quinoa",               "raw","kg",280,  "1008", 100,"loc-1"]),
  ii(["rm-010","RM-010","Amaranth",             "raw","kg",120,  "1008", 150,"loc-1"]),
  // Spices & Herbs (15)
  ii(["rm-011","RM-011","Turmeric Powder",      "raw","kg",140,  "0910", 300,"loc-1"]),
  ii(["rm-012","RM-012","Red Chilli Whole",     "raw","kg",180,  "0904", 250,"loc-1"]),
  ii(["rm-013","RM-013","Coriander Seeds",      "raw","kg", 90,  "0909", 400,"loc-1"]),
  ii(["rm-014","RM-014","Cumin Seeds",          "raw","kg",320,  "0909", 200,"loc-1"]),
  ii(["rm-015","RM-015","Black Pepper",         "raw","kg",480,  "0904",  80,"loc-1"]),
  ii(["rm-016","RM-016","Mustard Seeds",        "raw","kg", 65,  "1207", 350,"loc-1"]),
  ii(["rm-017","RM-017","Dried Ginger",         "raw","kg",200,  "0910", 150,"loc-1"]),
  ii(["rm-018","RM-018","Garlic Powder",        "raw","kg",350,  "0703", 100,"loc-1"]),
  ii(["rm-019","RM-019","Cardamom",             "raw","kg",2200, "0908",  30,"loc-1"]),
  ii(["rm-020","RM-020","Cloves",               "raw","kg",850,  "0907",  40,"loc-1"]),
  ii(["rm-021","RM-021","Cinnamon",             "raw","kg",380,  "0906",  60,"loc-1"]),
  ii(["rm-022","RM-022","Fenugreek Seeds",      "raw","kg", 75,  "1212", 200,"loc-1"]),
  ii(["rm-023","RM-023","Fennel Seeds",         "raw","kg",160,  "0909", 150,"loc-1"]),
  ii(["rm-024","RM-024","Carom Seeds (Ajwain)", "raw","kg",220,  "0909", 100,"loc-1"]),
  ii(["rm-025","RM-025","Asafoetida (Hing)",    "raw","kg",1800, "1301",  20,"loc-1"]),
  // Oils & Fats (5)
  ii(["rm-026","RM-026","Crude Sunflower Oil",  "raw","L",  95,  "1512", 500,"loc-1"]),
  ii(["rm-027","RM-027","Crude Mustard Oil",    "raw","L", 110,  "1514", 400,"loc-4"]),
  ii(["rm-028","RM-028","Crude Groundnut Oil",  "raw","L", 140,  "1508", 300,"loc-1"]),
  ii(["rm-029","RM-029","Crude Coconut Oil",    "raw","L", 165,  "1513", 200,"loc-1"]),
  ii(["rm-030","RM-030","Palm Oil",             "raw","L",  85,  "1511", 600,"loc-4"]),
  // Pulses (8)
  ii(["rm-031","RM-031","Toor Dal",             "raw","kg", 95,  "0713", 400,"loc-1"]),
  ii(["rm-032","RM-032","Chana Dal",            "raw","kg", 70,  "0713", 500,"loc-1"]),
  ii(["rm-033","RM-033","Moong Dal",            "raw","kg", 85,  "0713", 350,"loc-1"]),
  ii(["rm-034","RM-034","Urad Dal",             "raw","kg", 90,  "0713", 300,"loc-1"]),
  ii(["rm-035","RM-035","Rajma",                "raw","kg",100,  "0713", 200,"loc-1"]),
  ii(["rm-036","RM-036","Chickpeas",            "raw","kg", 75,  "0713", 400,"loc-4"]),
  ii(["rm-037","RM-037","Red Lentils (Masoor)", "raw","kg", 80,  "0713", 300,"loc-1"]),
  ii(["rm-038","RM-038","Green Peas (Dried)",   "raw","kg", 60,  "0713", 250,"loc-1"]),
  // Additives (2)
  ii(["rm-039","RM-039","Salt (Iodised)",       "raw","kg",  8,  "2501",1000,"loc-1"]),
  ii(["rm-040","RM-040","Sugar (Refined)",      "raw","kg", 42,  "1701", 800,"loc-1"]),

  // ── Packaging Materials (25) ─────────────────────────────────────────────
  // Films (6)
  ii(["pm-001","PM-001","BOPP Film Roll",            "packing","kg",145,"3920",150,"loc-8"]),
  ii(["pm-002","PM-002","PE Shrink Film",             "packing","kg",120,"3920",120,"loc-8"]),
  ii(["pm-003","PM-003","PET Film Roll",              "packing","kg",165,"3920",100,"loc-8"]),
  ii(["pm-004","PM-004","Multilayer Barrier Film",    "packing","kg",195,"3920", 80,"loc-8"]),
  ii(["pm-005","PM-005","Aluminium Foil Laminate",    "packing","kg",280,"7607", 60,"loc-8"]),
  ii(["pm-006","PM-006","Metalized BOPP Film",        "packing","kg",175,"3920", 90,"loc-8"]),
  // Cartons (5)
  ii(["pm-007","PM-007","Carton Box 24-unit",         "packing","pcs", 18,"4819",500,"loc-8"]),
  ii(["pm-008","PM-008","Carton Box 12-unit",         "packing","pcs", 14,"4819",600,"loc-8"]),
  ii(["pm-009","PM-009","Carton Box 6-unit",          "packing","pcs", 10,"4819",400,"loc-8"]),
  ii(["pm-010","PM-010","Master Shipping Carton",     "packing","pcs", 35,"4819",300,"loc-8"]),
  ii(["pm-011","PM-011","Display Box (12-unit)",      "packing","pcs", 22,"4819",200,"loc-8"]),
  // Pouches (5)
  ii(["pm-012","PM-012","Stand-up Pouch 1kg",         "packing","pcs",4.5,"3923",2000,"loc-8"]),
  ii(["pm-013","PM-013","Stand-up Pouch 500g",        "packing","pcs",3.2,"3923",3000,"loc-8"]),
  ii(["pm-014","PM-014","Flat Pouch 200g",            "packing","pcs",1.8,"3923",4000,"loc-8"]),
  ii(["pm-015","PM-015","Zip-lock Pouch 250g",        "packing","pcs",2.5,"3923",2500,"loc-8"]),
  ii(["pm-016","PM-016","Vacuum Pouch (Bulk)",        "packing","pcs",5.5,"3923",1000,"loc-8"]),
  // Jars & Bottles (4)
  ii(["pm-017","PM-017","PET Jar 500g",               "packing","pcs", 12,"3923",3000,"loc-8"]),
  ii(["pm-018","PM-018","PET Jar 250g",               "packing","pcs",  8,"3923",2000,"loc-8"]),
  ii(["pm-019","PM-019","Glass Bottle 500ml",         "packing","pcs", 22,"7010",1000,"loc-8"]),
  ii(["pm-020","PM-020","HDPE Bottle 1L",             "packing","pcs", 18,"3923",2000,"loc-8"]),
  // Labels & Closures (5)
  ii(["pm-021","PM-021","Paper Label Roll",           "packing","pcs",0.8,"4821",10000,"loc-8"]),
  ii(["pm-022","PM-022","Hologram Sticker Roll",      "packing","pcs",1.2,"4821", 5000,"loc-8"]),
  ii(["pm-023","PM-023","Shrink Sleeve",              "packing","pcs",0.6,"3919", 8000,"loc-8"]),
  ii(["pm-024","PM-024","Metal Lid (70mm)",           "packing","pcs",2.5,"8309", 3000,"loc-8"]),
  ii(["pm-025","PM-025","Plastic Cap",                "packing","pcs",0.9,"3923", 5000,"loc-8"]),

  // ── Semi-finished (20) ───────────────────────────────────────────────────
  ii(["sf-001","SF-001","Cleaned Wheat",              "semi-finished","kg", 24,"1101",500,"loc-1"],{ownership:"own"}),
  ii(["sf-002","SF-002","Cleaned Rice",               "semi-finished","kg", 30,"1006",400,"loc-1"],{ownership:"own"}),
  ii(["sf-003","SF-003","Rolled Oats (Semi)",         "semi-finished","kg", 65,"1104",200,"loc-1"],{ownership:"own"}),
  ii(["sf-004","SF-004","Parboiled Rice (Semi)",      "semi-finished","kg", 38,"1006",300,"loc-1"],{ownership:"own"}),
  ii(["sf-005","SF-005","Cracked Corn",               "semi-finished","kg", 22,"1102",250,"loc-4"],{ownership:"own"}),
  ii(["sf-006","SF-006","Masala Base Blend",          "semi-finished","kg",220,"2103",150,"loc-1"],{ownership:"own"}),
  ii(["sf-007","SF-007","Biryani Spice Premix",       "semi-finished","kg",380,"0910",100,"loc-1"],{ownership:"own"}),
  ii(["sf-008","SF-008","Curry Powder Base",          "semi-finished","kg",180,"0910",120,"loc-1"],{ownership:"own"}),
  ii(["sf-009","SF-009","Sambar Premix",              "semi-finished","kg",160,"0910",100,"loc-1"],{ownership:"own"}),
  ii(["sf-010","SF-010","Pav Bhaji Base",             "semi-finished","kg",200,"2103",100,"loc-4"],{ownership:"own"}),
  ii(["sf-011","SF-011","Ginger-Garlic Paste Bulk",   "semi-finished","kg",110,"2103",200,"loc-1"],{ownership:"own"}),
  ii(["sf-012","SF-012","Red Chilli Paste",           "semi-finished","kg",145,"2103",150,"loc-1"],{ownership:"own"}),
  ii(["sf-013","SF-013","Tamarind Concentrate",       "semi-finished","kg", 95,"2008",100,"loc-1"],{ownership:"own"}),
  ii(["sf-014","SF-014","Tomato Puree (Bulk)",        "semi-finished","kg", 45,"2002",200,"loc-4"],{ownership:"own"}),
  ii(["sf-015","SF-015","Wheat Flour (Mill Output)",  "semi-finished","kg", 30,"1101",600,"loc-1"],{ownership:"own"}),
  ii(["sf-016","SF-016","Semolina Coarse",            "semi-finished","kg", 32,"1103",400,"loc-1"],{ownership:"own"}),
  ii(["sf-017","SF-017","Besan (Chickpea Flour)",     "semi-finished","kg", 65,"1106",300,"loc-1"],{ownership:"own"}),
  ii(["sf-018","SF-018","Corn Flour",                 "semi-finished","kg", 40,"1108",200,"loc-4"],{ownership:"own"}),
  ii(["sf-019","SF-019","Ragi Flour (Mill Output)",   "semi-finished","kg", 50,"1102",200,"loc-1"],{ownership:"own"}),
  ii(["sf-020","SF-020","Sooji Fine (Semolina Fine)", "semi-finished","kg", 35,"1103",350,"loc-1"],{ownership:"own"}),

  // ── Finished Goods (55) ──────────────────────────────────────────────────
  // Atta & Flour (10)
  ii(["fg-001","FG-001","Wheat Atta 1kg",             "finished","pcs", 45,"1101",2000,"loc-1"],{ownership:"own",conversionRate:8}),
  ii(["fg-002","FG-002","Wheat Atta 5kg",             "finished","pcs",210,"1101", 800,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-003","FG-003","Wheat Atta 10kg",            "finished","pcs",395,"1101", 400,"loc-1"],{ownership:"own",conversionRate:12}),
  ii(["fg-004","FG-004","Multigrain Atta 1kg",        "finished","pcs", 80,"1101",1500,"loc-1"],{ownership:"own",conversionRate:12}),
  ii(["fg-005","FG-005","Chakki Fresh Atta 2kg",      "finished","pcs", 95,"1101",1000,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-006","FG-006","Rice Flour 1kg",             "finished","pcs", 55,"1102",1200,"loc-1"],{ownership:"own",conversionRate:7}),
  ii(["fg-007","FG-007","Maize Flour 500g",           "finished","pcs", 35,"1102", 800,"loc-4"],{ownership:"own",conversionRate:6}),
  ii(["fg-008","FG-008","Ragi Flour 500g",            "finished","pcs", 65,"1102", 600,"loc-1"],{ownership:"own",conversionRate:9}),
  ii(["fg-009","FG-009","Besan 500g",                 "finished","pcs", 58,"1106", 700,"loc-1"],{ownership:"own",conversionRate:8}),
  ii(["fg-010","FG-010","Jowar Flour 500g",           "finished","pcs", 40,"1102", 500,"loc-1"],{ownership:"own",conversionRate:7}),
  // Rice (6)
  ii(["fg-011","FG-011","Basmati Rice 1kg",           "finished","pcs",120,"1006",1500,"loc-2"],{ownership:"third-party",buyRate:95}),
  ii(["fg-012","FG-012","Basmati Rice 5kg",           "finished","pcs",575,"1006", 500,"loc-2"],{ownership:"third-party",buyRate:460}),
  ii(["fg-013","FG-013","Parboiled Rice 5kg",         "finished","pcs",240,"1006", 600,"loc-1"],{ownership:"own",conversionRate:8}),
  ii(["fg-014","FG-014","Brown Rice 1kg",             "finished","pcs", 95,"1006", 400,"loc-1"],{ownership:"own",conversionRate:9}),
  ii(["fg-015","FG-015","Sona Masuri 5kg",            "finished","pcs",260,"1006", 500,"loc-2"],{ownership:"third-party",buyRate:210}),
  ii(["fg-016","FG-016","Mini Idly Rice 1kg",         "finished","pcs", 75,"1006", 600,"loc-1"],{ownership:"own",conversionRate:7}),
  // Spice Mixes (10)
  ii(["fg-017","FG-017","Kitchen King 100g",          "finished","pcs", 48,"0910",2000,"loc-1"],{ownership:"own",conversionRate:18}),
  ii(["fg-018","FG-018","Chana Masala 100g",          "finished","pcs", 42,"0910",1800,"loc-1"],{ownership:"own",conversionRate:16}),
  ii(["fg-019","FG-019","Biryani Masala 50g",         "finished","pcs", 38,"0910",1500,"loc-1"],{ownership:"own",conversionRate:20}),
  ii(["fg-020","FG-020","Rajma Masala 100g",          "finished","pcs", 42,"0910",1200,"loc-1"],{ownership:"own",conversionRate:16}),
  ii(["fg-021","FG-021","Pav Bhaji Masala 100g",      "finished","pcs", 38,"0910",1400,"loc-4"],{ownership:"own",conversionRate:16}),
  ii(["fg-022","FG-022","Chole Masala 50g",           "finished","pcs", 35,"0910",1200,"loc-1"],{ownership:"own",conversionRate:20}),
  ii(["fg-023","FG-023","Sambar Powder 100g",         "finished","pcs", 40,"0910",1000,"loc-1"],{ownership:"own",conversionRate:15}),
  ii(["fg-024","FG-024","Rasam Powder 50g",           "finished","pcs", 32,"0910", 800,"loc-1"],{ownership:"own",conversionRate:18}),
  ii(["fg-025","FG-025","Garam Masala 50g",           "finished","pcs", 55,"0910",1500,"loc-1"],{ownership:"own",conversionRate:22}),
  ii(["fg-026","FG-026","Chicken Masala 50g",         "finished","pcs", 45,"0910",1000,"loc-1"],{ownership:"own",conversionRate:20}),
  // Ready Mixes (6)
  ii(["fg-027","FG-027","Dosa Mix 500g",              "finished","pcs", 75,"1901", 800,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-028","FG-028","Idli Mix 500g",              "finished","pcs", 70,"1901", 700,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-029","FG-029","Upma Mix 500g",              "finished","pcs", 65,"1901", 600,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-030","FG-030","Cake Mix 250g",              "finished","pcs", 85,"1901", 400,"loc-4"],{ownership:"own",conversionRate:14}),
  ii(["fg-031","FG-031","Gulab Jamun Mix 200g",       "finished","pcs", 60,"1901", 500,"loc-4"],{ownership:"own",conversionRate:15}),
  ii(["fg-032","FG-032","Instant Khichdi Mix 300g",   "finished","pcs", 55,"1904", 600,"loc-1"],{ownership:"own",conversionRate:12}),
  // Condiments & Sauces (6)
  ii(["fg-033","FG-033","Tomato Ketchup 500g",        "finished","pcs", 85,"2103", 800,"loc-4"],{ownership:"own",conversionRate:10}),
  ii(["fg-034","FG-034","Chilli Sauce 300ml",         "finished","pcs", 65,"2103", 600,"loc-4"],{ownership:"own",conversionRate:12}),
  ii(["fg-035","FG-035","Soy Sauce 200ml",            "finished","pcs", 55,"2103", 400,"loc-4"],{ownership:"own",conversionRate:14}),
  ii(["fg-036","FG-036","Green Chutney 200g",         "finished","pcs", 45,"2103", 500,"loc-1"],{ownership:"own",conversionRate:16}),
  ii(["fg-037","FG-037","Tamarind Chutney 200g",      "finished","pcs", 40,"2103", 500,"loc-1"],{ownership:"own",conversionRate:16}),
  ii(["fg-038","FG-038","Mint Sauce 200g",            "finished","pcs", 42,"2103", 400,"loc-1"],{ownership:"own",conversionRate:16}),
  // Pickles (5)
  ii(["fg-039","FG-039","Mango Pickle 500g",          "finished","pcs", 95,"2001", 700,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-040","FG-040","Lemon Pickle 300g",          "finished","pcs", 75,"2001", 500,"loc-1"],{ownership:"own",conversionRate:12}),
  ii(["fg-041","FG-041","Mixed Veg Pickle 400g",      "finished","pcs", 85,"2001", 600,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-042","FG-042","Garlic Pickle 250g",         "finished","pcs", 80,"2001", 400,"loc-1"],{ownership:"own",conversionRate:13}),
  ii(["fg-043","FG-043","Chilli Pickle 200g",         "finished","pcs", 70,"2001", 400,"loc-4"],{ownership:"own",conversionRate:14}),
  // Oils (6)
  ii(["fg-044","FG-044","Sunflower Oil 1L",           "finished","pcs",145,"1512",1500,"loc-1"],{ownership:"own",conversionRate:8}),
  ii(["fg-045","FG-045","Sunflower Oil 5L",           "finished","pcs",690,"1512", 500,"loc-1"],{ownership:"own",conversionRate:9}),
  ii(["fg-046","FG-046","Mustard Oil 1L",             "finished","pcs",165,"1514",1200,"loc-4"],{ownership:"own",conversionRate:9}),
  ii(["fg-047","FG-047","Groundnut Oil 1L",           "finished","pcs",195,"1508", 800,"loc-1"],{ownership:"own",conversionRate:9}),
  ii(["fg-048","FG-048","Coconut Oil 500ml",          "finished","pcs",220,"1513", 600,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-049","FG-049","Cold-pressed Sesame Oil 250ml","finished","pcs",185,"1515", 400,"loc-1"],{ownership:"own",conversionRate:12}),
  // Snacks & Health Foods (6)
  ii(["fg-050","FG-050","Roasted Poha 250g",          "finished","pcs", 55,"1904", 600,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-051","FG-051","Makhana Plain 100g",         "finished","pcs",120,"1904", 400,"loc-1"],{ownership:"third-party",buyRate:95}),
  ii(["fg-052","FG-052","Trail Mix 200g",             "finished","pcs", 95,"1904", 500,"loc-1"],{ownership:"own",conversionRate:12}),
  ii(["fg-053","FG-053","Oats Granola 400g",          "finished","pcs",185,"1904", 400,"loc-1"],{ownership:"own",conversionRate:10}),
  ii(["fg-054","FG-054","Puffed Amaranth 200g",       "finished","pcs",145,"1904", 300,"loc-1"],{ownership:"own",conversionRate:14}),
  ii(["fg-055","FG-055","Quinoa 500g",                "finished","pcs",320,"1008", 300,"loc-1"],{ownership:"third-party",buyRate:260}),
];

// ── BOMs (75 = 20 semi-finished + 55 finished) ───────────────────────────────
const DEMO_BOM: Record<string, BomComponent[]> = {
  // Semi-finished
  "sf-001": [{ itemId:"rm-001", qtyPerUnit:1.02 }],
  "sf-002": [{ itemId:"rm-002", qtyPerUnit:1.05 }],
  "sf-003": [{ itemId:"rm-007", qtyPerUnit:1.03 }],
  "sf-004": [{ itemId:"rm-002", qtyPerUnit:1.10 }],
  "sf-005": [{ itemId:"rm-006", qtyPerUnit:1.04 }],
  "sf-006": [{ itemId:"rm-013", qtyPerUnit:0.20 },{ itemId:"rm-012", qtyPerUnit:0.15 },{ itemId:"rm-011", qtyPerUnit:0.15 },{ itemId:"rm-014", qtyPerUnit:0.10 },{ itemId:"rm-016", qtyPerUnit:0.05 },{ itemId:"rm-039", qtyPerUnit:0.05 }],
  "sf-007": [{ itemId:"rm-013", qtyPerUnit:0.12 },{ itemId:"rm-011", qtyPerUnit:0.12 },{ itemId:"rm-019", qtyPerUnit:0.02 },{ itemId:"rm-020", qtyPerUnit:0.02 },{ itemId:"rm-021", qtyPerUnit:0.02 },{ itemId:"rm-014", qtyPerUnit:0.10 }],
  "sf-008": [{ itemId:"rm-011", qtyPerUnit:0.18 },{ itemId:"rm-013", qtyPerUnit:0.15 },{ itemId:"rm-014", qtyPerUnit:0.08 },{ itemId:"rm-016", qtyPerUnit:0.06 },{ itemId:"rm-039", qtyPerUnit:0.03 }],
  "sf-009": [{ itemId:"rm-031", qtyPerUnit:0.30 },{ itemId:"rm-013", qtyPerUnit:0.12 },{ itemId:"rm-011", qtyPerUnit:0.10 },{ itemId:"rm-016", qtyPerUnit:0.05 },{ itemId:"rm-039", qtyPerUnit:0.03 }],
  "sf-010": [{ itemId:"rm-013", qtyPerUnit:0.10 },{ itemId:"rm-011", qtyPerUnit:0.08 },{ itemId:"rm-014", qtyPerUnit:0.08 },{ itemId:"rm-022", qtyPerUnit:0.05 },{ itemId:"rm-039", qtyPerUnit:0.04 }],
  "sf-011": [{ itemId:"rm-017", qtyPerUnit:0.40 },{ itemId:"rm-018", qtyPerUnit:0.40 },{ itemId:"rm-039", qtyPerUnit:0.02 }],
  "sf-012": [{ itemId:"rm-012", qtyPerUnit:0.85 },{ itemId:"rm-039", qtyPerUnit:0.03 }],
  "sf-013": [{ itemId:"rm-022", qtyPerUnit:0.80 }],
  "sf-014": [{ itemId:"rm-039", qtyPerUnit:0.01 }], // placeholder; main input is fresh tomatoes (not in RM list)
  "sf-015": [{ itemId:"sf-001", qtyPerUnit:1.03 }],
  "sf-016": [{ itemId:"sf-001", qtyPerUnit:1.05 }],
  "sf-017": [{ itemId:"rm-036", qtyPerUnit:1.08 }],
  "sf-018": [{ itemId:"sf-005", qtyPerUnit:1.04 }],
  "sf-019": [{ itemId:"rm-005", qtyPerUnit:1.06 }],
  "sf-020": [{ itemId:"sf-001", qtyPerUnit:1.06 }],
  // Finished Goods — Atta & Flour
  "fg-001": [{ itemId:"sf-015", qtyPerUnit:1.02 },{ itemId:"pm-001", qtyPerUnit:0.025 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-002": [{ itemId:"sf-015", qtyPerUnit:5.10 },{ itemId:"pm-004", qtyPerUnit:0.10 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-003": [{ itemId:"sf-015", qtyPerUnit:10.2 },{ itemId:"pm-004", qtyPerUnit:0.18 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-004": [{ itemId:"sf-015", qtyPerUnit:0.40 },{ itemId:"rm-007", qtyPerUnit:0.25 },{ itemId:"rm-005", qtyPerUnit:0.15 },{ itemId:"rm-004", qtyPerUnit:0.15 },{ itemId:"pm-001", qtyPerUnit:0.025 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-005": [{ itemId:"sf-015", qtyPerUnit:2.04 },{ itemId:"pm-004", qtyPerUnit:0.05 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-006": [{ itemId:"sf-002", qtyPerUnit:1.04 },{ itemId:"pm-001", qtyPerUnit:0.025 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-007": [{ itemId:"sf-005", qtyPerUnit:0.52 },{ itemId:"pm-013", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-008": [{ itemId:"sf-019", qtyPerUnit:0.52 },{ itemId:"pm-013", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-009": [{ itemId:"sf-017", qtyPerUnit:0.52 },{ itemId:"pm-013", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-010": [{ itemId:"rm-003", qtyPerUnit:0.53 },{ itemId:"pm-013", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  // Rice
  "fg-013": [{ itemId:"sf-004", qtyPerUnit:5.10 },{ itemId:"pm-012", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-014": [{ itemId:"sf-002", qtyPerUnit:1.04 },{ itemId:"pm-012", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-016": [{ itemId:"sf-002", qtyPerUnit:1.04 },{ itemId:"pm-012", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  // Spice Mixes
  "fg-017": [{ itemId:"sf-006", qtyPerUnit:0.08 },{ itemId:"pm-018", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-018": [{ itemId:"sf-006", qtyPerUnit:0.08 },{ itemId:"rm-032", qtyPerUnit:0.02 },{ itemId:"pm-018", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-019": [{ itemId:"sf-007", qtyPerUnit:0.045 },{ itemId:"pm-014", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-020": [{ itemId:"sf-006", qtyPerUnit:0.08 },{ itemId:"rm-035", qtyPerUnit:0.02 },{ itemId:"pm-018", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-021": [{ itemId:"sf-010", qtyPerUnit:0.085 },{ itemId:"pm-018", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-022": [{ itemId:"sf-008", qtyPerUnit:0.042 },{ itemId:"rm-036", qtyPerUnit:0.01 },{ itemId:"pm-014", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-023": [{ itemId:"sf-009", qtyPerUnit:0.085 },{ itemId:"pm-018", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-024": [{ itemId:"sf-009", qtyPerUnit:0.042 },{ itemId:"pm-014", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-025": [{ itemId:"sf-006", qtyPerUnit:0.04 },{ itemId:"rm-019", qtyPerUnit:0.003 },{ itemId:"rm-020", qtyPerUnit:0.002 },{ itemId:"pm-014", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-026": [{ itemId:"sf-006", qtyPerUnit:0.035 },{ itemId:"rm-024", qtyPerUnit:0.005 },{ itemId:"rm-025", qtyPerUnit:0.001 },{ itemId:"pm-014", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  // Ready Mixes
  "fg-027": [{ itemId:"sf-002", qtyPerUnit:0.35 },{ itemId:"rm-034", qtyPerUnit:0.10 },{ itemId:"rm-039", qtyPerUnit:0.02 },{ itemId:"pm-013", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-028": [{ itemId:"sf-002", qtyPerUnit:0.38 },{ itemId:"rm-034", qtyPerUnit:0.08 },{ itemId:"rm-039", qtyPerUnit:0.02 },{ itemId:"pm-013", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-029": [{ itemId:"rm-003", qtyPerUnit:0.35 },{ itemId:"rm-033", qtyPerUnit:0.08 },{ itemId:"rm-039", qtyPerUnit:0.02 },{ itemId:"pm-013", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-030": [{ itemId:"sf-015", qtyPerUnit:0.12 },{ itemId:"rm-040", qtyPerUnit:0.08 },{ itemId:"pm-015", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-031": [{ itemId:"sf-015", qtyPerUnit:0.12 },{ itemId:"rm-040", qtyPerUnit:0.06 },{ itemId:"pm-015", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-032": [{ itemId:"sf-002", qtyPerUnit:0.18 },{ itemId:"rm-033", qtyPerUnit:0.08 },{ itemId:"rm-039", qtyPerUnit:0.02 },{ itemId:"pm-015", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  // Condiments
  "fg-033": [{ itemId:"sf-014", qtyPerUnit:0.30 },{ itemId:"rm-040", qtyPerUnit:0.08 },{ itemId:"rm-039", qtyPerUnit:0.01 },{ itemId:"pm-019", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-034": [{ itemId:"sf-012", qtyPerUnit:0.22 },{ itemId:"rm-039", qtyPerUnit:0.01 },{ itemId:"pm-019", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-035": [{ itemId:"rm-039", qtyPerUnit:0.02 },{ itemId:"rm-040", qtyPerUnit:0.05 },{ itemId:"pm-019", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-036": [{ itemId:"sf-011", qtyPerUnit:0.15 },{ itemId:"pm-017", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-037": [{ itemId:"sf-013", qtyPerUnit:0.18 },{ itemId:"rm-040", qtyPerUnit:0.02 },{ itemId:"pm-017", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-038": [{ itemId:"sf-011", qtyPerUnit:0.12 },{ itemId:"pm-017", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  // Pickles
  "fg-039": [{ itemId:"rm-039", qtyPerUnit:0.05 },{ itemId:"rm-027", qtyPerUnit:0.08 },{ itemId:"rm-014", qtyPerUnit:0.02 },{ itemId:"pm-017", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-040": [{ itemId:"rm-039", qtyPerUnit:0.04 },{ itemId:"rm-027", qtyPerUnit:0.05 },{ itemId:"rm-012", qtyPerUnit:0.01 },{ itemId:"pm-017", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-041": [{ itemId:"rm-039", qtyPerUnit:0.04 },{ itemId:"rm-027", qtyPerUnit:0.06 },{ itemId:"rm-012", qtyPerUnit:0.01 },{ itemId:"pm-017", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-042": [{ itemId:"rm-018", qtyPerUnit:0.20 },{ itemId:"rm-027", qtyPerUnit:0.04 },{ itemId:"rm-039", qtyPerUnit:0.02 },{ itemId:"pm-017", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-043": [{ itemId:"sf-012", qtyPerUnit:0.16 },{ itemId:"rm-039", qtyPerUnit:0.02 },{ itemId:"pm-017", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  // Oils
  "fg-044": [{ itemId:"rm-026", qtyPerUnit:1.04 },{ itemId:"pm-020", qtyPerUnit:1 },{ itemId:"pm-025", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-045": [{ itemId:"rm-026", qtyPerUnit:5.15 },{ itemId:"pm-020", qtyPerUnit:1 },{ itemId:"pm-025", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-046": [{ itemId:"rm-027", qtyPerUnit:1.04 },{ itemId:"pm-020", qtyPerUnit:1 },{ itemId:"pm-025", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-047": [{ itemId:"rm-028", qtyPerUnit:1.04 },{ itemId:"pm-020", qtyPerUnit:1 },{ itemId:"pm-025", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-048": [{ itemId:"rm-029", qtyPerUnit:0.52 },{ itemId:"pm-019", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-049": [{ itemId:"rm-029", qtyPerUnit:0.26 },{ itemId:"pm-018", qtyPerUnit:1 },{ itemId:"pm-024", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  // Snacks
  "fg-050": [{ itemId:"rm-001", qtyPerUnit:0.28 },{ itemId:"pm-014", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-052": [{ itemId:"rm-009", qtyPerUnit:0.08 },{ itemId:"rm-010", qtyPerUnit:0.06 },{ itemId:"rm-037", qtyPerUnit:0.06 },{ itemId:"pm-015", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-053": [{ itemId:"sf-003", qtyPerUnit:0.30 },{ itemId:"rm-040", qtyPerUnit:0.05 },{ itemId:"pm-012", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
  "fg-054": [{ itemId:"rm-010", qtyPerUnit:0.22 },{ itemId:"pm-015", qtyPerUnit:1 },{ itemId:"pm-021", qtyPerUnit:1 }],
};

// â”€â”€ EMPLOYEES (100) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type ES=[string,string,string,string,string,string|null,string];
const empSeed: ES[] = [
  // Management (5)
  ["Vikram Anand",          "Chief Executive Officer",            "dep-mgmt","ent-1","loc-1",null,       "2022-01-15"],
  ["Asha Menon",            "Chief Financial Officer",            "dep-fin", "ent-1","loc-1","emp-001",  "2022-03-01"],
  ["Sanjay Mehta",          "Chief Operating Officer",            "dep-ops", "ent-1","loc-1","emp-001",  "2022-04-01"],
  ["Meghna Kapoor",         "Chief Marketing Officer",            "dep-mkt", "ent-2","loc-2","emp-001",  "2022-06-01"],
  ["Rajeev Sharma",         "Chief Technology Officer",           "dep-it",  "ent-1","loc-1","emp-001",  "2022-07-01"],
  // Finance (10)
  ["Priya Krishnan",        "Finance Manager",                    "dep-fin", "ent-1","loc-1","emp-002",  "2022-08-01"],
  ["Arjun Nair",            "Senior Accountant",                  "dep-fin", "ent-1","loc-1","emp-006",  "2023-01-02"],
  ["Divya Patel",           "Accountant",                         "dep-fin", "ent-1","loc-1","emp-006",  "2023-03-15"],
  ["Rahul Joshi",           "Tax Manager",                        "dep-fin", "ent-1","loc-1","emp-002",  "2022-11-01"],
  ["Neha Iyer",             "Finance Analyst",                    "dep-fin", "ent-1","loc-1","emp-006",  "2023-06-01"],
  ["Kiran Kumar",           "AP Executive",                       "dep-fin", "ent-1","loc-1","emp-006",  "2023-07-15"],
  ["Sunita Reddy",          "AR Executive",                       "dep-fin", "ent-2","loc-2","emp-002",  "2023-04-01"],
  ["Manoj Singh",           "Treasury Manager",                   "dep-fin", "ent-1","loc-1","emp-002",  "2022-10-01"],
  ["Pooja Bhat",            "Finance Analyst",                    "dep-fin", "ent-3","loc-3","emp-002",  "2024-01-15"],
  ["Arun Gupta",            "Accounts Executive",                 "dep-fin", "ent-2","loc-2","emp-006",  "2024-03-01"],
  // Sales (15)
  ["Ravi Kapoor",           "VP Sales",                           "dep-sal", "ent-1","loc-1","emp-001",  "2022-05-01"],
  ["Suresh Kumar",          "Regional Sales Manager â€” South",     "dep-sal", "ent-1","loc-1","emp-016",  "2022-09-01"],
  ["Anjali Verma",          "Regional Sales Manager â€” West",      "dep-sal", "ent-2","loc-2","emp-016",  "2023-02-01"],
  ["Deepak Nair",           "Regional Sales Manager â€” South II",  "dep-sal", "ent-2","loc-5","emp-016",  "2023-05-01"],
  ["Kavita Rao",            "Regional Sales Manager â€” North",     "dep-sal", "ent-3","loc-3","emp-016",  "2023-08-01"],
  ["Aditya Shah",           "Sales Executive",                    "dep-sal", "ent-1","loc-1","emp-017",  "2023-09-01"],
  ["Bhavna Mehta",          "Sales Executive",                    "dep-sal", "ent-1","loc-1","emp-017",  "2023-10-01"],
  ["Chetan Patil",          "Sales Executive",                    "dep-sal", "ent-2","loc-2","emp-018",  "2023-11-01"],
  ["Deepika Srivastava",    "Sales Executive",                    "dep-sal", "ent-2","loc-2","emp-018",  "2024-01-02"],
  ["Eshan Tiwari",          "Sales Executive",                    "dep-sal", "ent-2","loc-5","emp-019",  "2024-02-01"],
  ["Farida Qureshi",        "Key Account Manager",                "dep-sal", "ent-1","loc-1","emp-016",  "2023-01-15"],
  ["Gaurav Nair",           "Sales Executive",                    "dep-sal", "ent-3","loc-3","emp-020",  "2024-03-01"],
  ["Harini Subramanian",    "Sales Executive",                    "dep-sal", "ent-3","loc-7","emp-020",  "2024-04-01"],
  ["Ishaan Malhotra",       "Sales Coordinator",                  "dep-sal", "ent-1","loc-1","emp-017",  "2024-05-01"],
  ["Jaya Pillai",           "Sales Coordinator",                  "dep-sal", "ent-2","loc-6","emp-018",  "2024-06-01"],
  // Marketing (5)
  ["Kishore Venkat",        "Marketing Manager",                  "dep-mkt", "ent-1","loc-1","emp-004",  "2022-08-15"],
  ["Lata Bose",             "Brand Manager",                      "dep-mkt", "ent-1","loc-1","emp-031",  "2023-02-15"],
  ["Monika Agarwal",        "Brand Manager",                      "dep-mkt", "ent-2","loc-2","emp-031",  "2023-07-01"],
  ["Naveen Shetty",         "Digital Marketing Manager",          "dep-mkt", "ent-1","loc-1","emp-031",  "2023-09-15"],
  ["Ojas Deshpande",        "Marketing Executive",                "dep-mkt", "ent-2","loc-2","emp-031",  "2024-01-15"],
  // HR (8)
  ["Priya Nair",            "HR Manager",                         "dep-hr",  "ent-1","loc-1","emp-001",  "2022-08-01"],
  ["Qureshi Bilal",         "HR Executive",                       "dep-hr",  "ent-1","loc-1","emp-036",  "2023-03-01"],
  ["Rekha Thomas",          "Payroll Manager",                    "dep-hr",  "ent-1","loc-1","emp-036",  "2022-11-01"],
  ["Sameer Kulkarni",       "Talent Acquisition Lead",            "dep-hr",  "ent-1","loc-1","emp-036",  "2023-06-15"],
  ["Tara Singh",            "HR Executive",                       "dep-hr",  "ent-2","loc-2","emp-036",  "2023-10-01"],
  ["Uma Krishnaswamy",      "L&D Manager",                        "dep-hr",  "ent-1","loc-1","emp-036",  "2024-01-02"],
  ["Vignesh Rajan",         "IR & Compliance Officer",            "dep-hr",  "ent-1","loc-1","emp-036",  "2023-05-01"],
  ["Wahida Shaikh",         "HR Admin",                           "dep-hr",  "ent-3","loc-3","emp-036",  "2024-03-15"],
  // Operations (10)
  ["Arjun Sharma",          "VP Operations",                      "dep-ops", "ent-1","loc-1","emp-003",  "2022-05-01"],
  ["Balaji Iyer",           "Plant Manager â€” Bengaluru",          "dep-ops", "ent-1","loc-1","emp-044",  "2022-09-01"],
  ["Chandra Mohan",         "Plant Manager â€” Pune",               "dep-ops", "ent-1","loc-4","emp-044",  "2023-01-01"],
  ["Damini Rao",            "Production Supervisor",              "dep-ops", "ent-1","loc-1","emp-045",  "2023-04-01"],
  ["Emmanuel Peter",        "Production Supervisor",              "dep-ops", "ent-1","loc-4","emp-046",  "2023-07-01"],
  ["Faisal Ahmed",          "Maintenance Manager",                "dep-ops", "ent-1","loc-1","emp-044",  "2023-02-01"],
  ["Geetha Natarajan",      "Safety Officer",                     "dep-ops", "ent-1","loc-1","emp-003",  "2023-08-01"],
  ["Hemant Dubey",          "Production Supervisor",              "dep-ops", "ent-1","loc-1","emp-045",  "2024-01-15"],
  ["Isha Gupta",            "Process Engineer",                   "dep-ops", "ent-1","loc-4","emp-046",  "2024-02-01"],
  ["Jayesh Parekh",         "Utilities Engineer",                 "dep-ops", "ent-1","loc-1","emp-049",  "2024-03-15"],
  // Production (12)
  ["Kalyani Pillai",        "Line Operator â€” Atta",               "dep-prod","ent-1","loc-1","emp-045",  "2023-01-15"],
  ["Lokesh Naidu",          "Line Operator â€” Spices",             "dep-prod","ent-1","loc-1","emp-045",  "2023-02-01"],
  ["Malvika Soni",          "Line Operator â€” Oils",               "dep-prod","ent-1","loc-1","emp-047",  "2023-03-01"],
  ["Narender Yadav",        "Line Operator â€” Sauces",             "dep-prod","ent-1","loc-4","emp-046",  "2023-04-01"],
  ["Omkar Jadhav",          "Line Operator â€” Mixes",              "dep-prod","ent-1","loc-4","emp-046",  "2023-05-01"],
  ["Poonam Sawant",         "Line Operator â€” Packing",            "dep-prod","ent-1","loc-8","emp-045",  "2023-06-01"],
  ["Rajendra Gaikwad",      "Line Operator â€” Packing",            "dep-prod","ent-1","loc-8","emp-045",  "2023-07-01"],
  ["Santosh More",          "Line Operator â€” Rice",               "dep-prod","ent-1","loc-1","emp-047",  "2023-08-01"],
  ["Tejas Bhosale",         "Line Operator â€” Atta",               "dep-prod","ent-1","loc-1","emp-045",  "2024-01-02"],
  ["Urmila Jagtap",         "Line Operator â€” Packing",            "dep-prod","ent-1","loc-8","emp-056",  "2024-02-15"],
  ["Vikas Kale",            "Line Operator â€” Spices",             "dep-prod","ent-1","loc-1","emp-045",  "2024-03-01"],
  ["Waman Shinde",          "Packing Machine Operator",           "dep-prod","ent-1","loc-8","emp-056",  "2024-04-01"],
  // Procurement (8)
  ["Kiran Patel",           "Procurement Manager",                "dep-proc","ent-1","loc-1","emp-003",  "2022-10-01"],
  ["Yadav Sunil",           "Senior Buyer â€” RM",                  "dep-proc","ent-1","loc-1","emp-067",  "2023-02-01"],
  ["Zubair Khan",           "Senior Buyer â€” PM",                  "dep-proc","ent-1","loc-8","emp-067",  "2023-05-01"],
  ["Ashwini Datar",         "SCM Analyst",                        "dep-proc","ent-1","loc-1","emp-067",  "2023-08-01"],
  ["Babu Krishnan",         "SCM Analyst",                        "dep-proc","ent-2","loc-2","emp-067",  "2024-01-02"],
  ["Chandrika Menon",       "Vendor Relations Manager",           "dep-proc","ent-1","loc-1","emp-067",  "2023-11-01"],
  ["Dattatray Pawar",       "Stores Manager",                     "dep-proc","ent-1","loc-1","emp-067",  "2022-12-01"],
  ["Ekta Sharma",           "Inventory Controller",               "dep-proc","ent-1","loc-4","emp-074",  "2024-02-01"],
  // IT (5)
  ["Firoz Ansari",          "IT Manager",                         "dep-it",  "ent-1","loc-1","emp-005",  "2022-09-01"],
  ["Gopika Suresh",         "Systems Administrator",              "dep-it",  "ent-1","loc-1","emp-074",  "2023-04-01"],
  ["Harshad Kulkarni",      "Data Analyst",                       "dep-it",  "ent-1","loc-1","emp-074",  "2023-07-15"],
  ["Irfan Shaikh",          "IT Support Engineer",                "dep-it",  "ent-2","loc-2","emp-074",  "2024-01-02"],
  ["Jyothi Reddy",          "IT Support Engineer",                "dep-it",  "ent-1","loc-4","emp-074",  "2024-03-01"],
  // Logistics (8)
  ["Kannan Pillai",         "Logistics Manager",                  "dep-log", "ent-2","loc-2","emp-003",  "2022-11-01"],
  ["Lakshman Rao",          "Dispatch Executive",                 "dep-log", "ent-1","loc-1","emp-079",  "2023-03-01"],
  ["Meenakshi Velu",        "Dispatch Executive",                 "dep-log", "ent-2","loc-2","emp-079",  "2023-06-01"],
  ["Nilesh Desai",          "Warehouse Executive",                "dep-log", "ent-1","loc-4","emp-079",  "2023-09-01"],
  ["Pallavi Joshi",         "Route Planner",                      "dep-log", "ent-2","loc-2","emp-079",  "2024-01-02"],
  ["Qadir Hussain",         "Fleet Coordinator",                  "dep-log", "ent-3","loc-3","emp-079",  "2023-12-01"],
  ["Ramesh Shetty",         "Warehouse Executive",                "dep-log", "ent-3","loc-7","emp-079",  "2024-02-15"],
  ["Savita Tiwari",         "Customs & Documentation",            "dep-log", "ent-3","loc-3","emp-079",  "2023-10-01"],
  // Quality (7)
  ["Tarun Mehta",           "QA Manager",                         "dep-qlt", "ent-1","loc-1","emp-003",  "2022-10-15"],
  ["Uma Devi",              "QC Analyst",                         "dep-qlt", "ent-1","loc-1","emp-087",  "2023-02-01"],
  ["Vijayalakshmi P.",      "QC Analyst",                         "dep-qlt", "ent-1","loc-4","emp-087",  "2023-05-01"],
  ["Wasim Shaikh",          "Lab Analyst",                        "dep-qlt", "ent-1","loc-1","emp-087",  "2023-08-01"],
  ["Xenia D'Souza",         "Food Safety Officer",                "dep-qlt", "ent-1","loc-1","emp-087",  "2024-01-15"],
  ["Yogesh Bansal",         "Regulatory Affairs Executive",       "dep-qlt", "ent-1","loc-1","emp-087",  "2023-11-01"],
  ["Zainab Mirza",          "QA Executive",                       "dep-qlt", "ent-2","loc-2","emp-087",  "2024-03-01"],
  // R&D (4)
  ["Aishwarya Iyengar",     "Head of R&D",                        "dep-rnd", "ent-1","loc-1","emp-001",  "2022-06-01"],
  ["Bharat Narayanan",      "Food Scientist",                     "dep-rnd", "ent-1","loc-1","emp-094",  "2023-01-15"],
  ["Chitra Balakrishnan",   "Food Scientist",                     "dep-rnd", "ent-1","loc-4","emp-094",  "2023-06-01"],
  ["Dhruv Aggarwal",        "NPD Manager",                        "dep-rnd", "ent-1","loc-1","emp-094",  "2023-09-15"],
  // Legal (2)
  ["Ela Nair",              "Legal Counsel",                      "dep-leg", "ent-1","loc-1","emp-001",  "2023-04-01"],
  ["Farrukh Tashkentov",    "Compliance Officer",                 "dep-leg", "ent-1","loc-1","emp-098",  "2024-01-02"],
  // Customer Service (1)
  ["Geeta Balaji",          "Customer Service Manager",           "dep-cs",  "ent-1","loc-1","emp-001",  "2023-07-01"],
];

const DEMO_EMPLOYEES: Employee[] = empSeed.map(([name,designation,departmentId,entityId,locationId,managerId,joinDate],i)=>({
  id:`emp-${pad(i+1)}`,
  code:`EMP-${pad(i+1)}`,
  name,
  email:`${name.toLowerCase().replace(/[^a-z]/g,".")}@nexafoods.example`,
  personalEmail:`${name.split(" ")[0].toLowerCase()}${(i+1)*7%99+1}@gmail.com`,
  designation,
  departmentId,
  entityId,
  locationId,
  managerId,
  joinDate,
  employmentType:"full-time" as const,
  status:"active" as const,
}));

// â”€â”€ BANK ACCOUNTS (3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEMO_BANK_ACCOUNTS: BankAccount[] = [
  { id:"bank-1", entityId:"ent-1", accountCode:"1020", bankName:"HDFC Bank",  number:"5011 2233 4455", ifsc:"HDFC0001234", currency:"INR", opening:5000000 },
  { id:"bank-2", entityId:"ent-2", accountCode:"1020", bankName:"Axis Bank",  number:"9201 3344 5566", ifsc:"UTIB0002345", currency:"INR", opening:3000000 },
  { id:"bank-3", entityId:"ent-3", accountCode:"1020", bankName:"ICICI Bank", number:"6022 7788 1122", ifsc:"ICIC0005678", currency:"INR", opening:2000000 },
];

// â”€â”€ CRM ACCOUNTS (75) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type AS=[string,string,string,CrmAccount["industry"],string,string,string,string,string,string,string,string,CrmAccount["stage"],number,string,string];
const accSeed: AS[]=[
  ["acc-01","FreshMart Retail","FreshMart Retail Pvt Ltd","Retail Chain","29AABCF1234L1Z9","14 MG Road","Bengaluru","Karnataka","29","purchase@freshmart.in","+91 80 1234 5678","freshmart.in","won",3600000,"2024-04-01","ent-1"],
  ["acc-02","Nature's Basket","Nature's Basket Supermarkets Ltd","Retail Chain","29AABCN2345M1Z8","22 Residency Rd","Bengaluru","Karnataka","29","buying@naturesbasket.in","+91 80 2345 6789","naturesbasket.in","won",2800000,"2024-05-01","ent-1"],
  ["acc-03","BigBazaar South","Future Retail Ltd â€” South Zone","Retail Chain","29AABCB3456N1Z7","Future Square, Koramangala","Bengaluru","Karnataka","29","vendor@bigbazaar.in","+91 80 3456 7890","bigbazaar.in","won",4200000,"2024-03-15","ent-1"],
  ["acc-04","Metro Wholesale","Metro Cash & Carry India Pvt Ltd","Distribution","36AABCM4567O1Z6","Survey No. 240, Medchal","Hyderabad","Telangana","36","procurement@metro.in","+91 40 4567 8901","metro.in","won",5600000,"2024-02-01","ent-1"],
  ["acc-05","FoodWorld Stores","FoodWorld Supermarkets Pvt Ltd","Retail Chain","33AABCF5678P1Z5","12 Anna Salai","Chennai","Tamil Nadu","33","supply@foodworld.in","+91 44 5678 9012","foodworld.in","won",2100000,"2024-06-01","ent-1"],
  ["acc-06","Spencer's Retail","Spencer's Retail Ltd","Retail Chain","19AABCS6789Q1Z4","27 Park Street","Kolkata","West Bengal","19","sourcing@spencers.in","+91 33 6789 0123","spencers.in","won",1800000,"2024-07-01","ent-1"],
  ["acc-07","WinMart Outlets","WinMart Retail Pvt Ltd","Retail Chain","32AABCW7890R1Z3","MG Road, Ernakulam","Kochi","Kerala","32","purchase@winmart.in","+91 484 7890 1234","winmart.in","won",1500000,"2024-08-01","ent-1"],
  ["acc-08","Nilgiris Stores","The Nilgiris Dairy Farm Pvt Ltd","Retail Chain","29AABCN8901S1Z2","Nilgiris House, Brigade Rd","Bengaluru","Karnataka","29","buyers@nilgiris.in","+91 80 8901 2345","nilgiris.in","won",2400000,"2024-09-01","ent-1"],
  ["acc-09","Heritage Foods","Heritage Foods Ltd","Distribution","29AABCH9012T1Z1","Plot 44, Whitefield","Bengaluru","Karnataka","29","trade@heritagefoods.in","+91 80 9012 3456","heritagefoods.in","won",3200000,"2024-04-15","ent-1"],
  ["acc-10","Spar Hypermarket","Spar Hypermarkets India Pvt Ltd","Retail Chain","29AABCS0123U1Z9","Spar Centre, Cunningham Rd","Bengaluru","Karnataka","29","grocery@spar.in","+91 80 0123 4567","spar.in","won",2600000,"2025-01-01","ent-1"],
  ["acc-11","Ratnadeep Retail","Ratnadeep Retail Ltd","Retail Chain","36AABCR1234V1Z8","Banjara Hills","Hyderabad","Telangana","36","purchase@ratnadeep.in","+91 40 1234 5679","ratnadeep.in","won",1900000,"2025-02-01","ent-1"],
  ["acc-12","KK Kitchens HoReCa","K K Kitchens & Catering Pvt Ltd","HoReCa","29AABCK2345W1Z7","Industrial Area, Peenya","Bengaluru","Karnataka","29","procurement@kkkitchens.in","+91 80 2345 6780","kkkitchens.in","won",1200000,"2025-03-01","ent-1"],
  ["acc-13","BlueMart Stores","BlueMart Stores Ltd","Retail Chain","27AABCB3456X1Z6","22 Linking Road","Mumbai","Maharashtra","27","buying@bluemart.in","+91 22 3456 7891","bluemart.in","won",4800000,"2024-03-01","ent-2"],
  ["acc-14","D-Mart West","Avenue Supermarts Ltd","Distribution","27AABCA4567Y1Z5","Hiranandani Gardens","Mumbai","Maharashtra","27","vendor.west@dmart.in","+91 22 4567 8902","dmart.in","won",8400000,"2024-01-15","ent-2"],
  ["acc-15","QuickKart","QuickKart Commerce Pvt Ltd","Quick Commerce","06AABCQ5678Z1Z4","Tower 5, Cyber City","Gurugram","Haryana","06","vendor@quickkart.in","+91 124 5678 9013","quickkart.in","won",6200000,"2024-05-01","ent-2"],
  ["acc-16","Reliance Fresh","Reliance Retail Ltd â€” FMCG","Retail Chain","27AABCR6789A1Z3","Maker Chambers VI","Mumbai","Maharashtra","27","sourcing.fmcg@ril.com","+91 22 6789 0124","relianceretail.in","won",9600000,"2024-02-01","ent-2"],
  ["acc-17","Swiggy Instamart","Bundl Technologies Pvt Ltd","Quick Commerce","29AABCS7890B1Z2","Embassy Tech Village","Bengaluru","Karnataka","29","brands@swiggyinstamart.in","+91 80 7890 1235","swiggyinstamart.in","won",5200000,"2025-01-01","ent-2"],
  ["acc-18","Zepto","Kiranakart Technologies Pvt Ltd","Quick Commerce","29AABCZ8901C1Z1","JP Nagar","Bengaluru","Karnataka","29","brands@zepto.in","+91 80 8901 2346","zepto.in","won",4400000,"2025-02-01","ent-2"],
  ["acc-19","JioMart","Reliance Jio Infocomm Ltd","E-commerce","27AABCJ9012D1Z9","Jio Centre, BKC","Mumbai","Maharashtra","27","seller@jiomart.in","+91 22 9012 3457","jiomart.in","won",7200000,"2024-06-01","ent-2"],
  ["acc-20","Blinkit","Zomato Ltd â€” Blinkit","Quick Commerce","06AABCB0123E1Z8","DLF Cyber Hub","Gurugram","Haryana","06","partner@blinkit.com","+91 124 0123 4568","blinkit.com","won",5800000,"2024-08-01","ent-2"],
  ["acc-21","Bigbasket","Supermarket Grocery Supplies Pvt Ltd","E-commerce","29AABCB1234F1Z7","9th Floor, UB City","Bengaluru","Karnataka","29","brands@bigbasket.com","+91 80 1234 5680","bigbasket.com","won",11200000,"2024-04-01","ent-2"],
  ["acc-22","Star Bazaar","Trent Hypermarket Pvt Ltd","Retail Chain","27AABCS2345G1Z6","Bombay House, Homi Mody St","Mumbai","Maharashtra","27","vendor@starbazaar.in","+91 22 2345 6781","starbazaar.in","won",3600000,"2024-07-01","ent-2"],
  ["acc-23","Al Adil Trading","Al Adil Trading LLC","Export","AE","JAFZA, Gate 5","Dubai","UAE (Export)","00","buy@aladiltrading.ae","+971 4 2345 678","aladiltrading.ae","won",8000000,"2024-04-01","ent-3"],
  ["acc-24","Lulu Hypermarket","Lulu International Shopping Malls","Export","AE","JAFZA","Abu Dhabi","UAE (Export)","00","grocery.india@luluhyper.com","+971 2 3456 789","luluhypermarket.com","won",12000000,"2024-06-01","ent-3"],
  ["acc-25","NRI Bazaar USA","NRI Bazaar Inc","Export","US","1218 Oak Tree Rd","Edison NJ","USA (Export)","00","import@nribazaar.com","+1 732 456 7890","nribazaar.com","won",6400000,"2024-08-01","ent-3"],
  ["acc-26","Indian Grocery UK","Indian Grocery Ltd","Export","GB","42 Soho Road","Birmingham","UK (Export)","00","supply@indiangroceryuk.co.uk","+44 121 456 7891","indiangroceryuk.co.uk","won",4000000,"2025-01-01","ent-3"],
  ["acc-27","Apna Market SG","Apna Market Pte Ltd","Export","SG","Mustafa Centre","Singapore","Singapore (Export)","00","indiagoods@apnamarket.sg","+65 6456 7892","apnamarket.sg","won",3200000,"2025-02-01","ent-3"],
  ["acc-28","Desi Superstore CA","Desi Superstore Ltd","Export","CA","2350 Hurontario St","Mississauga ON","Canada (Export)","00","import@desisuperstore.ca","+1 905 567 8903","desisuperstore.ca","won",2800000,"2025-03-01","ent-3"],
  ["acc-29","More Supermarket","More Retail Pvt Ltd","Retail Chain","29AABCM3456H1Z5","Prestige Meridian","Bengaluru","Karnataka","29","trade@more.in","+91 80 3456 7892","more.in","negotiation",3600000,"2025-07-01","ent-1"],
  ["acc-30","EasyDay Club","Bharti Retail Pvt Ltd","Retail Chain","06AABCE4567I1Z4","Cyber Greens, DLF III","Gurugram","Haryana","06","vendor@easyday.in","+91 124 4567 8904","easyday.in","negotiation",2400000,"2025-08-01","ent-1"],
  ["acc-31","Godrej Nature's Basket","Godrej Consumer Products Ltd","Retail Chain","27AABCG5678J1Z3","Godrej One, Pirojshanagar","Mumbai","Maharashtra","27","buying@naturesbasket.in","+91 22 5678 9015","naturesbasket.com","negotiation",1800000,"2025-09-01","ent-1"],
  ["acc-32","Akshaya Patra","The Akshaya Patra Foundation","Institutional","29AABCA6789K1Z2","HQ: Rajajinagar","Bengaluru","Karnataka","29","procurement@akshayapatra.org","+91 80 6789 0126","akshayapatra.org","negotiation",4200000,"2025-10-01","ent-1"],
  ["acc-33","ITC Hotels","ITC Hotels Ltd","HoReCa","19AABCI7890L1Z1","Virginia House, Chowringhee Rd","Kolkata","West Bengal","19","purchase.food@itchotels.in","+91 33 7890 1237","itchotels.in","negotiation",2100000,"2025-09-15","ent-1"],
  ["acc-34","Taj Hotels","Indian Hotels Company Ltd","HoReCa","27AABCT8901M1Z9","Mandlik Rd, Colaba","Mumbai","Maharashtra","27","f.b@tajhotels.com","+91 22 8901 2348","tajhotels.com","negotiation",2800000,"2025-10-15","ent-1"],
  ["acc-35","Oberoi Hotels","EIH Ltd","HoReCa","07AABCE9012N1Z8","7 Sham Nath Marg","New Delhi","Delhi","07","fb.purchase@oberoihotels.com","+91 11 9012 3459","oberoihotels.com","negotiation",1900000,"2025-11-01","ent-1"],
  ["acc-36","Army Canteen (CSD)","Canteen Stores Department","Institutional","07AABCA0123O1Z7","Kendriya Bhandar","Bengaluru","Karnataka","29","procurement@csd.nic.in","+91 80 0123 4570","csd.nic.in","negotiation",5200000,"2025-11-15","ent-1"],
  ["acc-37","Amazon Pantry","Amazon Seller Services Pvt Ltd","E-commerce","29AABCA1234P1Z6","Brigade Gateway","Bengaluru","Karnataka","29","vendor.pantry@amazon.in","+91 80 1234 5681","amazon.in","negotiation",6800000,"2025-08-01","ent-2"],
  ["acc-38","Myntra Grocery","Myntra Jabong India Pvt Ltd","E-commerce","29AABCM2345Q1Z5","Myntra Campus","Bengaluru","Karnataka","29","grocery@myntra.com","+91 80 2345 6782","myntra.com","negotiation",2200000,"2025-09-01","ent-2"],
  ["acc-39","PaytmMall","One97 Communications Ltd","E-commerce","07AABCP3456R1Z4","B-121 Sector 5 Noida","Noida","Uttar Pradesh","09","vendor@paytmmall.com","+91 120 3456 7893","paytmmall.com","negotiation",3200000,"2025-10-01","ent-2"],
  ["acc-40","Flipkart Grocery","Flipkart Internet Pvt Ltd","E-commerce","29AABCF4567S1Z3","Flipkart Campus","Bengaluru","Karnataka","29","grocery.brands@flipkart.com","+91 80 4567 8904","flipkart.com","negotiation",5400000,"2025-07-01","ent-2"],
  ["acc-41","Dunzo Daily","Dunzo Digital Pvt Ltd","Quick Commerce","29AABCD5678T1Z2","Residency Rd","Bengaluru","Karnataka","29","brands@dunzo.in","+91 80 5678 9015","dunzo.in","negotiation",1800000,"2025-11-01","ent-2"],
  ["acc-42","Supr Daily","Supr Daily (Swiggy)","Quick Commerce","29AABCS6789U1Z1","Swiggy Campus","Bengaluru","Karnataka","29","brands@suprdaily.in","+91 80 6789 0127","suprdaily.in","negotiation",2400000,"2025-10-15","ent-2"],
  ["acc-43","Milk Basket","Milkbasket Services Pvt Ltd","Quick Commerce","06AABCM7890V1Z9","DLF Cyber City","Gurugram","Haryana","06","partner@milkbasket.com","+91 124 7890 1238","milkbasket.com","negotiation",1600000,"2025-11-15","ent-2"],
  ["acc-44","Green Basket Foods","Green Basket Foods Pvt Ltd","E-commerce","33AABCG8901W1Z8","7 Anna Salai","Chennai","Tamil Nadu","33","supply@greenbasket.in","+91 44 8901 2349","greenbasket.in","proposal",900000,"2025-10-01","ent-1"],
  ["acc-45","Namdhari's Fresh","Namdhari's Fresh Pvt Ltd","Retail Chain","29AABCN9012X1Z7","Namdhari House, Sadashivanagar","Bengaluru","Karnataka","29","purchase@namdharis.in","+91 80 9012 3460","namdharis.in","proposal",1200000,"2025-11-01","ent-1"],
  ["acc-46","Srinivasa Caterers","Srinivasa Catering Services","HoReCa","29AABCS0123Y1Z6","Kathriguppe","Bengaluru","Karnataka","29","bulk@srinivasacaterers.in","+91 80 0123 4571","srinivasacaterers.in","proposal",800000,"2025-11-15","ent-1"],
  ["acc-47","Ola Foods","Ola Electric Mobility (Foods)","E-commerce","29AABCO1234Z1Z5","Sarjapur Rd","Bengaluru","Karnataka","29","brands@olafoods.in","+91 80 1234 5682","olafoods.in","proposal",1600000,"2025-12-01","ent-1"],
  ["acc-48","Hyperpure Zomato","Zomato Ltd â€” Hyperpure","HoReCa","29AABCH2345A1Z4","Intermediate Ring Rd","Bengaluru","Karnataka","29","vendor@hyperpure.com","+91 80 2345 6783","hyperpure.com","proposal",2800000,"2025-12-15","ent-1"],
  ["acc-49","Grofers Now","Grofers India Pvt Ltd","Quick Commerce","06AABCG3456B1Z3","D-5 Sector 3 Noida","Noida","Uttar Pradesh","09","brands@grofers.com","+91 120 3456 7894","grofers.com","proposal",2000000,"2026-01-01","ent-1"],
  ["acc-50","Apni Mandi","Apni Mandi Retail Pvt Ltd","Retail Chain","08AABCA4567C1Z2","MG Road Jaipur","Jaipur","Rajasthan","08","purchase@apnimandi.in","+91 141 4567 8905","apnimandi.in","proposal",700000,"2025-11-01","ent-2"],
  ["acc-51","Vishal Mega Mart","Vishal Mega Mart Ltd","Retail Chain","06AABCV5678D1Z1","Plot 32 Sector 27","Gurugram","Haryana","06","vendor@vishalmegamart.in","+91 124 5678 9016","vishalmegamart.in","proposal",1800000,"2025-10-01","ent-2"],
  ["acc-52","City Hypermarket","City Hypermarket Pvt Ltd","Retail Chain","21AABCC6789E1Z9","Sahid Nagar","Bhubaneswar","Odisha","21","sourcing@cityhyper.in","+91 674 6789 0128","cityhyper.in","proposal",900000,"2025-12-01","ent-2"],
  ["acc-53","Smaaash Kitchens","Smaaash Entertainment Pvt Ltd","HoReCa","27AABCS7890F1Z8","WeWork BKC","Mumbai","Maharashtra","27","kitchen@smaaash.in","+91 22 7890 1239","smaaash.in","proposal",500000,"2026-01-01","ent-2"],
  ["acc-54","Tasty Treat Caterers","Tasty Treat Catering Pvt Ltd","HoReCa","27AABCT8901G1Z7","Kurla West","Mumbai","Maharashtra","27","bulk@tastytreats.in","+91 22 8901 2350","tastytreats.in","proposal",600000,"2025-12-15","ent-2"],
  ["acc-55","GoodEats Cloud Kitchen","GoodEats Cloud Kitchen Pvt Ltd","HoReCa","29AABCG9012H1Z6","Koramangala 5th Block","Bengaluru","Karnataka","29","supplies@goodeats.in","+91 80 9012 3461","goodeats.in","proposal",400000,"2026-01-15","ent-2"],
  ["acc-56","Masala King Qatar","Masala King Trading WLL","Export","QA","Al Nasr Doha","Doha","Qatar (Export)","00","import@masakingqatar.com","+974 4456 7895","masakingqatar.com","proposal",2400000,"2026-01-01","ent-3"],
  ["acc-57","Flavors of India AUS","Flavors of India Pty Ltd","Export","AU","123 Victoria St","Melbourne","Australia (Export)","00","import@flavorsofindia.com.au","+61 3 9456 7896","flavorsofindia.com.au","proposal",1800000,"2026-02-01","ent-3"],
  ["acc-58","Spice Route NL","Spice Route International BV","Export","NL","Kruisweg 821","Hoofddorp","Netherlands (Export)","00","india@spiceroute.nl","+31 23 456 7897","spiceroute.nl","proposal",2200000,"2026-01-15","ent-3"],
  ["acc-59","Prasuma Meals","Prasuma Pvt Ltd","HoReCa","07AABCP0123I1Z5","Saket District Centre","New Delhi","Delhi","07","supply@prasuma.com","+91 11 0123 4572","prasuma.com","qualified",800000,"2026-02-01","ent-1"],
  ["acc-60","FoodHub Kitchen","FoodHub Technologies Pvt Ltd","HoReCa","29AABCF1234J1Z4","Indiranagar 100ft Rd","Bengaluru","Karnataka","29","procurement@foodhub.in","+91 80 1234 5683","foodhub.in","qualified",600000,"2026-02-15","ent-1"],
  ["acc-61","Coorg Cuisine Exports","Coorg Cuisine Pvt Ltd","Export","29AABCC2345K1Z3","Madikeri","Coorg","Karnataka","29","export@coorgcuisine.in","+91 8272 345 678","coorgcuisine.in","qualified",1200000,"2026-03-01","ent-1"],
  ["acc-62","Arogya Health Foods","Arogya Naturals Pvt Ltd","Institutional","29AABCA3456L1Z2","Electronic City Phase I","Bengaluru","Karnataka","29","bulk@arogyanaturals.in","+91 80 3456 7895","arogyanaturals.in","qualified",900000,"2026-02-01","ent-1"],
  ["acc-63","Zepto Hyderabad","Kiranakart Tech Hyderabad","Quick Commerce","36AABCZ4567M1Z1","Banjara Hills","Hyderabad","Telangana","36","hyderabad@zepto.in","+91 40 4567 8906","zepto.in","qualified",2200000,"2026-02-01","ent-2"],
  ["acc-64","Go Zero Ice Cream","Go Zero Pvt Ltd","HoReCa","29AABCG5678N1Z9","Indiranagar","Bengaluru","Karnataka","29","ingredients@gozero.in","+91 80 5678 9017","gozero.in","qualified",400000,"2026-03-01","ent-2"],
  ["acc-65","Nawabi Catering","Nawabi Catering Pvt Ltd","HoReCa","09AABCL6789O1Z8","Hazratganj","Lucknow","Uttar Pradesh","09","supply@nawabicatering.in","+91 522 6789 0129","nawabicatering.in","qualified",500000,"2026-02-15","ent-2"],
  ["acc-66","Saravana Bhavan","Hotel Saravana Bhavan Pvt Ltd","HoReCa","33AABCS7890P1Z7","Nelson Manickam Rd","Chennai","Tamil Nadu","33","catering@saravanabhavan.in","+91 44 7890 1240","saravanabhavan.in","qualified",1800000,"2026-03-01","ent-2"],
  ["acc-67","Gourmet Garden Cafes","Gourmet Garden F&B Pvt Ltd","HoReCa","27AABCG8901Q1Z6","Hiranandani","Mumbai","Maharashtra","27","procurement@gourmetgarden.in","+91 22 8901 2351","gourmetgarden.in","qualified",700000,"2026-03-15","ent-2"],
  ["acc-68","Curry Leaf USA","Curry Leaf LLC","Export","US","888 Devon Ave","Chicago IL","USA (Export)","00","import@curryleaf-usa.com","+1 773 567 8908","curryleaf-usa.com","qualified",1600000,"2026-02-01","ent-3"],
  ["acc-69","Desi Kitchen KL","Desi Kitchen Sdn Bhd","Export","MY","Lot 15 Jalan Ipoh","Kuala Lumpur","Malaysia (Export)","00","import@desikitchenkl.my","+60 3 5678 9009","desikitchenkl.my","qualified",1200000,"2026-03-01","ent-3"],
  ["acc-70","Fresh Amma Pickles","Fresh Amma Foods Pvt Ltd","Retail Chain","29AABCF9012R1Z5","RT Nagar","Bengaluru","Karnataka","29","info@freshammapickles.in","+91 80 9012 3462","freshammapickles.in","lead",400000,"2026-04-01","ent-1"],
  ["acc-71","AshiCorp Meals","AshiCorp F&B Pvt Ltd","HoReCa","29AABCA0123S1Z4","JP Nagar 7th Phase","Bengaluru","Karnataka","29","bulk@ashicorpmeals.in","+91 80 0123 4573","ashicorpmeals.in","lead",300000,"2026-05-01","ent-1"],
  ["acc-72","Healthy Bites Chain","Healthy Bites Restaurant Chain","HoReCa","29AABCH1234T1Z3","Whitefield","Bengaluru","Karnataka","29","purchase@healthybites.in","+91 80 1234 5684","healthybites.in","lead",500000,"2026-05-15","ent-1"],
  ["acc-73","TasteFine Foods","TasteFine Foods Pvt Ltd","HoReCa","29AABCT2345U1Z2","Jayanagar 9th Block","Bengaluru","Karnataka","29","supply@tastefine.in","+91 80 2345 6784","tastefine.in","lead",200000,"2026-06-01","ent-2"],
  ["acc-74","Spice Emporium BH","Spice Emporium Co WLL","Export","BH","Manama Souk","Manama","Bahrain (Export)","00","import@spiceemporiumgcc.com","+973 1756 7900","spiceemporiumgcc.com","lead",800000,"2026-05-01","ent-3"],
  ["acc-75","Namaste Grocery FR","Namaste Grocery SARL","Export","FR","45 Rue de la Paix","Paris","France (Export)","00","india@namasteepicerie.fr","+33 1 5678 9011","namasteepicerie.fr","lead",600000,"2026-06-01","ent-3"],
];

const DEMO_ACCOUNTS: CrmAccount[] = accSeed.map(
  ([id,name,legalName,industry,gstin,address,city,state,stateCode,email,phone,website,stage,dealValue,since,entityId])=>({
    id,name,legalName,industry,gstin,address,city,state,stateCode,email,phone,website,
    ownerId:stage==="won"?"emp-016":stage==="negotiation"?"emp-017":stage==="proposal"?"emp-021":"emp-022",
    entityId,stage,dealValue,since,
  })
);

const cnames=["Rajesh Verma","Sunita Nair","Anil Sharma","Pooja Mehta","Suresh Pillai","Ananya Iyer","Vikash Gupta","Rekha Thomas","Deepak Joshi","Lakshmi Rao","Pradeep Shetty","Meena Reddy","Ravi Prasad","Kavitha Kumar","Sanjay Bose","Archana Menon","Harish Patel","Divya Sharma","Manoj Nair","Priya Krishnan","Rahul Singh","Seema Desai","Ajay Pandey","Nandita Roy","Kiran Murthy","Geeta Iyer","Varun Shah","Swati Kulkarni","Vijay Rao","Meena Devi","Sachin Tiwari","Usha Nambiar","Ashok Jain","Preeti Ghosh","Mahesh Swamy","Lavanya Suresh","Rohan Kaul","Anjali Patel","Nikhil Bhatt","Sudha Naik","Aditya Srivastava","Bhavna Jain","Chetan Doshi","Deepa Choudhary","Eshan Malhotra","Farzana Hussain","Gaurav Sharma","Harini Balaji","Ishwar Das","Jyoti Kumari","Kaushik Sen","Leela Menon","Mukesh Gupta","Nalini Iyer","Omkar Patil","Pallavi Desai","Quamar Haasan","Rashmi Shetty","Satish Hegde","Teena Khanna","Ujwal Rao","Vanitha Suresh","Waseem Baig","Xena Fernandes","Yamini Sharma","Zara Patel","Ajith Menon","Bharati Nair","Chitralekha Roy","Devika Pillai","Esha Verma","Francis Xavier","Ganesh Rao","Hema Malini P.","Irene Sequeira","Jatin Malhotra"];
const ctitles=["Purchase Manager","Senior Buyer","Category Head","Procurement Lead","Head of Sourcing","Commercial Manager","Trade Partner Manager","Vendor Relations Head","Operations Director","GM Procurement"];

const DEMO_CONTACTS: CrmContact[] = DEMO_ACCOUNTS.map((a,i)=>({
  id:`con-${pad(i+1)}`,
  accountId:a.id,
  name:cnames[i%cnames.length],
  title:ctitles[i%ctitles.length],
  email:`contact${i+1}@${a.website}`,
  phone:`+91 9${String(8000000+i*11117).slice(0,9)}`,
  primary:true,
}));


// â”€â”€ INVENTORY MOVEMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper
const mv = (id:string,date:string,itemId:string,locationId:string,type:Movement["type"],qty:number,ref?:string,batch?:string): Movement =>
  ({ id, date, itemId, locationId, type, qty, ...(ref?{ref}:{}), ...(batch?{batchNo:batch}:{}) });

const DEMO_MOVEMENTS: Movement[] = [
  // â”€â”€ Opening stock Jan 1 2026 at loc-1 (Bengaluru Plant) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mv("mv-0001","2026-01-01","rm-001","loc-1","opening",8000),
  mv("mv-0002","2026-01-01","rm-002","loc-1","opening",5000),
  mv("mv-0003","2026-01-01","rm-003","loc-1","opening",2000),
  mv("mv-0004","2026-01-01","rm-006","loc-1","opening",3000),
  mv("mv-0005","2026-01-01","rm-007","loc-1","opening",1200),
  mv("mv-0006","2026-01-01","rm-011","loc-1","opening",800),
  mv("mv-0007","2026-01-01","rm-012","loc-1","opening",600),
  mv("mv-0008","2026-01-01","rm-013","loc-1","opening",1000),
  mv("mv-0009","2026-01-01","rm-014","loc-1","opening",400),
  mv("mv-0010","2026-01-01","rm-026","loc-1","opening",1500),
  mv("mv-0011","2026-01-01","rm-027","loc-1","opening",1200),
  mv("mv-0012","2026-01-01","rm-039","loc-1","opening",3000),
  mv("mv-0013","2026-01-01","rm-040","loc-1","opening",2500),
  mv("mv-0014","2026-01-01","pm-001","loc-8","opening",500),
  mv("mv-0015","2026-01-01","pm-004","loc-8","opening",300),
  mv("mv-0016","2026-01-01","pm-007","loc-8","opening",2000),
  mv("mv-0017","2026-01-01","pm-012","loc-8","opening",5000),
  mv("mv-0018","2026-01-01","pm-013","loc-8","opening",8000),
  mv("mv-0019","2026-01-01","pm-017","loc-8","opening",4000),
  mv("mv-0020","2026-01-01","pm-021","loc-8","opening",20000),
  // Opening FG stock at loc-1
  mv("mv-0021","2026-01-01","fg-001","loc-1","opening",3000),
  mv("mv-0022","2026-01-01","fg-002","loc-1","opening",800),
  mv("mv-0023","2026-01-01","fg-004","loc-1","opening",1500),
  mv("mv-0024","2026-01-01","fg-006","loc-1","opening",1200),
  mv("mv-0025","2026-01-01","fg-017","loc-1","opening",2500),
  mv("mv-0026","2026-01-01","fg-018","loc-1","opening",2000),
  mv("mv-0027","2026-01-01","fg-025","loc-1","opening",3000),
  mv("mv-0028","2026-01-01","fg-039","loc-1","opening",1500),
  mv("mv-0029","2026-01-01","fg-044","loc-1","opening",2000),
  mv("mv-0030","2026-01-01","fg-045","loc-1","opening",600),
  // Opening at loc-2 (Mumbai DC) FG
  mv("mv-0031","2026-01-01","fg-001","loc-2","opening",2000),
  mv("mv-0032","2026-01-01","fg-011","loc-2","opening",1500),
  mv("mv-0033","2026-01-01","fg-012","loc-2","opening",500),
  mv("mv-0034","2026-01-01","fg-013","loc-2","opening",800),
  mv("mv-0035","2026-01-01","fg-017","loc-2","opening",1800),
  // Opening at loc-4 (Pune Factory) RM
  mv("mv-0036","2026-01-01","rm-006","loc-4","opening",2000),
  mv("mv-0037","2026-01-01","rm-027","loc-4","opening",800),
  mv("mv-0038","2026-01-01","sf-005","loc-4","opening",500),
  mv("mv-0039","2026-01-01","fg-021","loc-4","opening",1200),
  mv("mv-0040","2026-01-01","fg-033","loc-4","opening",800),

  // â”€â”€ JANUARY 2026 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Receipts from vendors (GRN-001 to GRN-005)
  mv("mv-0041","2026-01-08","rm-001","loc-1","receipt",5000,"GRN-001","BT-2601"),
  mv("mv-0042","2026-01-08","rm-002","loc-1","receipt",3000,"GRN-001","BT-2602"),
  mv("mv-0043","2026-01-10","pm-001","loc-8","receipt",300,"GRN-002"),
  mv("mv-0044","2026-01-10","pm-004","loc-8","receipt",200,"GRN-002"),
  mv("mv-0045","2026-01-10","pm-013","loc-8","receipt",5000,"GRN-002"),
  mv("mv-0046","2026-01-12","rm-011","loc-1","receipt",400,"GRN-003"),
  mv("mv-0047","2026-01-12","rm-013","loc-1","receipt",600,"GRN-003"),
  mv("mv-0048","2026-01-14","rm-026","loc-1","receipt",1000,"GRN-004"),
  mv("mv-0049","2026-01-20","rm-027","loc-4","receipt",600,"GRN-005"),
  mv("mv-0050","2026-01-20","rm-006","loc-4","receipt",2000,"GRN-005"),
  // Production â€” Jan (Bengaluru, Wheat Atta 1kg run)
  mv("mv-0051","2026-01-15","rm-001","loc-1","consumption",-5100,"PRD-JAN-01"),
  mv("mv-0052","2026-01-15","pm-001","loc-8","consumption",-125,"PRD-JAN-01"),
  mv("mv-0053","2026-01-15","pm-021","loc-8","consumption",-5000,"PRD-JAN-01"),
  mv("mv-0054","2026-01-15","fg-001","loc-1","production",5000,"PRD-JAN-01"),
  // Production â€” Jan (Spice Mix run)
  mv("mv-0055","2026-01-18","rm-013","loc-1","consumption",-480,"PRD-JAN-02"),
  mv("mv-0056","2026-01-18","rm-011","loc-1","consumption",-320,"PRD-JAN-02"),
  mv("mv-0057","2026-01-18","rm-014","loc-1","consumption",-240,"PRD-JAN-02"),
  mv("mv-0058","2026-01-18","pm-017","loc-8","consumption",-2000,"PRD-JAN-02"),
  mv("mv-0059","2026-01-18","pm-021","loc-8","consumption",-2000,"PRD-JAN-02"),
  mv("mv-0060","2026-01-18","fg-017","loc-1","production",2000,"PRD-JAN-02"),
  mv("mv-0061","2026-01-18","fg-018","loc-1","production",1500,"PRD-JAN-02"),
  // Sales dispatches â€” Jan
  mv("mv-0062","2026-01-20","fg-001","loc-1","sale",-2000,"INV-2601"),
  mv("mv-0063","2026-01-20","fg-017","loc-1","sale",-1200,"INV-2601"),
  mv("mv-0064","2026-01-22","fg-001","loc-2","sale",-1500,"INV-2602"),
  mv("mv-0065","2026-01-22","fg-011","loc-2","sale",-800,"INV-2602"),
  mv("mv-0066","2026-01-25","fg-025","loc-1","sale",-1500,"INV-2603"),
  mv("mv-0067","2026-01-25","fg-039","loc-1","sale",-800,"INV-2603"),
  mv("mv-0068","2026-01-28","fg-044","loc-1","sale",-600,"INV-2604"),

  // â”€â”€ FEBRUARY 2026 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mv("mv-0069","2026-02-05","rm-001","loc-1","receipt",6000,"GRN-006","BT-2603"),
  mv("mv-0070","2026-02-05","rm-002","loc-1","receipt",4000,"GRN-006","BT-2604"),
  mv("mv-0071","2026-02-07","pm-001","loc-8","receipt",350,"GRN-007"),
  mv("mv-0072","2026-02-07","pm-013","loc-8","receipt",6000,"GRN-007"),
  mv("mv-0073","2026-02-07","pm-017","loc-8","receipt",3000,"GRN-007"),
  mv("mv-0074","2026-02-10","rm-026","loc-1","receipt",1200,"GRN-008"),
  mv("mv-0075","2026-02-10","rm-027","loc-4","receipt",800,"GRN-008"),
  // Production â€” Feb
  mv("mv-0076","2026-02-12","rm-001","loc-1","consumption",-6120,"PRD-FEB-01"),
  mv("mv-0077","2026-02-12","pm-001","loc-8","consumption",-150,"PRD-FEB-01"),
  mv("mv-0078","2026-02-12","pm-021","loc-8","consumption",-6000,"PRD-FEB-01"),
  mv("mv-0079","2026-02-12","fg-001","loc-1","production",6000,"PRD-FEB-01"),
  mv("mv-0080","2026-02-14","rm-002","loc-1","consumption",-3120,"PRD-FEB-02"),
  mv("mv-0081","2026-02-14","pm-013","loc-8","consumption",-6000,"PRD-FEB-02"),
  mv("mv-0082","2026-02-14","pm-021","loc-8","consumption",-6000,"PRD-FEB-02"),
  mv("mv-0083","2026-02-14","fg-006","loc-1","production",6000,"PRD-FEB-02"),
  // Sales â€” Feb
  mv("mv-0084","2026-02-18","fg-001","loc-1","sale",-2500,"INV-2605"),
  mv("mv-0085","2026-02-18","fg-006","loc-1","sale",-2000,"INV-2605"),
  mv("mv-0086","2026-02-20","fg-001","loc-2","sale",-2000,"INV-2606"),
  mv("mv-0087","2026-02-20","fg-013","loc-2","sale",-600,"INV-2606"),
  mv("mv-0088","2026-02-22","fg-017","loc-1","sale",-1800,"INV-2607"),
  mv("mv-0089","2026-02-22","fg-039","loc-1","sale",-900,"INV-2607"),
  mv("mv-0090","2026-02-25","fg-044","loc-1","sale",-800,"INV-2608"),

  // â”€â”€ MARCH 2026 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mv("mv-0091","2026-03-04","rm-001","loc-1","receipt",7000,"GRN-009","BT-2605"),
  mv("mv-0092","2026-03-04","rm-013","loc-1","receipt",800,"GRN-009"),
  mv("mv-0093","2026-03-06","pm-004","loc-8","receipt",250,"GRN-010"),
  mv("mv-0094","2026-03-06","pm-017","loc-8","receipt",4000,"GRN-010"),
  mv("mv-0095","2026-03-10","rm-026","loc-1","receipt",1500,"GRN-011"),
  mv("mv-0096","2026-03-10","rm-006","loc-4","receipt",2500,"GRN-011"),
  // Production â€” Mar
  mv("mv-0097","2026-03-12","rm-001","loc-1","consumption",-7140,"PRD-MAR-01"),
  mv("mv-0098","2026-03-12","pm-004","loc-8","consumption",-140,"PRD-MAR-01"),
  mv("mv-0099","2026-03-12","pm-021","loc-8","consumption",-7000,"PRD-MAR-01"),
  mv("mv-0100","2026-03-12","fg-002","loc-1","production",1400,"PRD-MAR-01"),  // 5kg packs
  mv("mv-0101","2026-03-15","rm-026","loc-1","consumption",-1560,"PRD-MAR-02"),
  mv("mv-0102","2026-03-15","pm-020","loc-8","consumption",-1500,"PRD-MAR-02"),
  mv("mv-0103","2026-03-15","pm-021","loc-8","consumption",-1500,"PRD-MAR-02"),
  mv("mv-0104","2026-03-15","fg-044","loc-1","production",1500,"PRD-MAR-02"),
  // Sales â€” Mar
  mv("mv-0105","2026-03-18","fg-002","loc-1","sale",-600,"INV-2609"),
  mv("mv-0106","2026-03-18","fg-001","loc-1","sale",-3000,"INV-2609"),
  mv("mv-0107","2026-03-20","fg-044","loc-1","sale",-1200,"INV-2610"),
  mv("mv-0108","2026-03-22","fg-017","loc-1","sale",-2000,"INV-2611"),
  mv("mv-0109","2026-03-22","fg-018","loc-1","sale",-1500,"INV-2611"),
  mv("mv-0110","2026-03-25","fg-001","loc-2","sale",-2500,"INV-2612"),
  mv("mv-0111","2026-03-28","fg-025","loc-1","sale",-2000,"INV-2613"),
  // Stock adjustment (cycle count variance)
  mv("mv-0112","2026-03-31","rm-039","loc-1","adjustment",-50,"CNT-MAR-01"),

  // â”€â”€ APRIL 2026 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mv("mv-0113","2026-04-05","rm-001","loc-1","receipt",8000,"GRN-012","BT-2606"),
  mv("mv-0114","2026-04-05","rm-002","loc-1","receipt",5000,"GRN-012","BT-2607"),
  mv("mv-0115","2026-04-08","pm-001","loc-8","receipt",400,"GRN-013"),
  mv("mv-0116","2026-04-08","pm-013","loc-8","receipt",8000,"GRN-013"),
  mv("mv-0117","2026-04-10","rm-027","loc-4","receipt",1000,"GRN-014"),
  // Production â€” Apr
  mv("mv-0118","2026-04-12","rm-001","loc-1","consumption",-8160,"PRD-APR-01"),
  mv("mv-0119","2026-04-12","pm-001","loc-8","consumption",-200,"PRD-APR-01"),
  mv("mv-0120","2026-04-12","pm-021","loc-8","consumption",-8000,"PRD-APR-01"),
  mv("mv-0121","2026-04-12","fg-001","loc-1","production",8000,"PRD-APR-01"),
  mv("mv-0122","2026-04-16","rm-027","loc-4","consumption",-1040,"PRD-APR-02"),
  mv("mv-0123","2026-04-16","pm-020","loc-8","consumption",-1000,"PRD-APR-02"),
  mv("mv-0124","2026-04-16","fg-046","loc-4","production",1000,"PRD-APR-02"),
  // Sales â€” Apr
  mv("mv-0125","2026-04-18","fg-001","loc-1","sale",-3500,"INV-2614"),
  mv("mv-0126","2026-04-20","fg-001","loc-2","sale",-3000,"INV-2615"),
  mv("mv-0127","2026-04-22","fg-017","loc-1","sale",-2200,"INV-2616"),
  mv("mv-0128","2026-04-24","fg-046","loc-4","sale",-600,"INV-2617"),
  mv("mv-0129","2026-04-26","fg-039","loc-1","sale",-1000,"INV-2618"),

  // â”€â”€ MAY 2026 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mv("mv-0130","2026-05-06","rm-001","loc-1","receipt",9000,"GRN-015","BT-2608"),
  mv("mv-0131","2026-05-06","rm-002","loc-1","receipt",6000,"GRN-015","BT-2609"),
  mv("mv-0132","2026-05-08","pm-001","loc-8","receipt",500,"GRN-016"),
  mv("mv-0133","2026-05-08","pm-017","loc-8","receipt",5000,"GRN-016"),
  mv("mv-0134","2026-05-10","rm-026","loc-1","receipt",2000,"GRN-017"),
  // Production â€” May
  mv("mv-0135","2026-05-12","rm-001","loc-1","consumption",-9180,"PRD-MAY-01"),
  mv("mv-0136","2026-05-12","pm-001","loc-8","consumption",-225,"PRD-MAY-01"),
  mv("mv-0137","2026-05-12","pm-021","loc-8","consumption",-9000,"PRD-MAY-01"),
  mv("mv-0138","2026-05-12","fg-001","loc-1","production",9000,"PRD-MAY-01"),
  mv("mv-0139","2026-05-16","rm-026","loc-1","consumption",-2080,"PRD-MAY-02"),
  mv("mv-0140","2026-05-16","pm-020","loc-8","consumption",-2000,"PRD-MAY-02"),
  mv("mv-0141","2026-05-16","fg-044","loc-1","production",2000,"PRD-MAY-02"),
  mv("mv-0142","2026-05-18","rm-013","loc-1","consumption",-600,"PRD-MAY-03"),
  mv("mv-0143","2026-05-18","rm-011","loc-1","consumption",-400,"PRD-MAY-03"),
  mv("mv-0144","2026-05-18","pm-017","loc-8","consumption",-3000,"PRD-MAY-03"),
  mv("mv-0145","2026-05-18","fg-017","loc-1","production",3000,"PRD-MAY-03"),
  // Sales â€” May
  mv("mv-0146","2026-05-20","fg-001","loc-1","sale",-4000,"INV-2619"),
  mv("mv-0147","2026-05-22","fg-001","loc-2","sale",-3500,"INV-2620"),
  mv("mv-0148","2026-05-24","fg-044","loc-1","sale",-1500,"INV-2621"),
  mv("mv-0149","2026-05-26","fg-017","loc-1","sale",-2500,"INV-2622"),
  mv("mv-0150","2026-05-28","fg-025","loc-1","sale",-2500,"INV-2623"),

  // â”€â”€ JUNE 2026 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mv("mv-0151","2026-06-04","rm-001","loc-1","receipt",7000,"GRN-018","BT-2610"),
  mv("mv-0152","2026-06-04","rm-002","loc-1","receipt",4500,"GRN-018","BT-2611"),
  mv("mv-0153","2026-06-06","pm-001","loc-8","receipt",400,"GRN-019"),
  mv("mv-0154","2026-06-06","pm-013","loc-8","receipt",7000,"GRN-019"),
  mv("mv-0155","2026-06-08","rm-026","loc-1","receipt",1800,"GRN-020"),
  // Production â€” Jun
  mv("mv-0156","2026-06-10","rm-001","loc-1","consumption",-7140,"PRD-JUN-01"),
  mv("mv-0157","2026-06-10","pm-001","loc-8","consumption",-175,"PRD-JUN-01"),
  mv("mv-0158","2026-06-10","pm-021","loc-8","consumption",-7000,"PRD-JUN-01"),
  mv("mv-0159","2026-06-10","fg-001","loc-1","production",7000,"PRD-JUN-01"),
  mv("mv-0160","2026-06-14","rm-026","loc-1","consumption",-1872,"PRD-JUN-02"),
  mv("mv-0161","2026-06-14","pm-020","loc-8","consumption",-1800,"PRD-JUN-02"),
  mv("mv-0162","2026-06-14","fg-044","loc-1","production",1800,"PRD-JUN-02"),
  // Sales â€” Jun
  mv("mv-0163","2026-06-16","fg-001","loc-1","sale",-3500,"INV-2624"),
  mv("mv-0164","2026-06-18","fg-001","loc-2","sale",-3000,"INV-2625"),
  mv("mv-0165","2026-06-20","fg-017","loc-1","sale",-2000,"INV-2626"),
  mv("mv-0166","2026-06-22","fg-044","loc-1","sale",-1200,"INV-2627"),
  mv("mv-0167","2026-06-24","fg-025","loc-1","sale",-1800,"INV-2628"),
  // Transfer movements (loc-1 â†’ loc-2)
  mv("mv-0168","2026-01-25","fg-001","loc-1","transfer-out",-3000,"TRF-001"),
  mv("mv-0169","2026-01-27","fg-001","loc-2","transfer-in",3000,"TRF-001"),
  mv("mv-0170","2026-02-22","fg-006","loc-1","transfer-out",-2000,"TRF-002"),
  mv("mv-0171","2026-02-24","fg-006","loc-2","transfer-in",2000,"TRF-002"),
  mv("mv-0172","2026-03-20","fg-017","loc-1","transfer-out",-2500,"TRF-003"),
  mv("mv-0173","2026-03-22","fg-017","loc-2","transfer-in",2500,"TRF-003"),
  mv("mv-0174","2026-04-18","fg-001","loc-1","transfer-out",-4000,"TRF-004"),
  mv("mv-0175","2026-04-20","fg-001","loc-2","transfer-in",4000,"TRF-004"),
  mv("mv-0176","2026-05-16","fg-044","loc-1","transfer-out",-1500,"TRF-005"),
  mv("mv-0177","2026-05-18","fg-044","loc-2","transfer-in",1500,"TRF-005"),
  mv("mv-0178","2026-06-12","fg-001","loc-1","transfer-out",-2500,"TRF-006"),
  mv("mv-0179","2026-06-14","fg-001","loc-2","transfer-in",2500,"TRF-006"),
  // loc-2 â†’ loc-5 (Chennai)
  mv("mv-0180","2026-02-15","fg-001","loc-2","transfer-out",-1000,"TRF-007"),
  mv("mv-0181","2026-02-17","fg-001","loc-5","transfer-in",1000,"TRF-007"),
  mv("mv-0182","2026-04-10","fg-017","loc-2","transfer-out",-800,"TRF-008"),
  mv("mv-0183","2026-04-12","fg-017","loc-5","transfer-in",800,"TRF-008"),
  mv("mv-0184","2026-06-05","fg-001","loc-2","transfer-out",-1200,"TRF-009"),
  mv("mv-0185","2026-06-07","fg-001","loc-5","transfer-in",1200,"TRF-009"),
  // loc-1 â†’ loc-7 (Kolkata/Export)
  mv("mv-0186","2026-03-10","fg-001","loc-1","transfer-out",-2000,"TRF-010"),
  mv("mv-0187","2026-03-13","fg-001","loc-7","transfer-in",2000,"TRF-010"),
  mv("mv-0188","2026-05-08","fg-017","loc-1","transfer-out",-1500,"TRF-011"),
  mv("mv-0189","2026-05-11","fg-017","loc-7","transfer-in",1500,"TRF-011"),
];

// â”€â”€ STOCK TRANSFERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEMO_TRANSFERS: TransferOrder[] = [
  { id:"trf-001",ref:"TRF-001",fromLocationId:"loc-1",toLocationId:"loc-2",status:"received",dispatchDate:"2026-01-25",expectedArrival:"2026-01-28",receivedDate:"2026-01-27",lines:[{itemId:"fg-001",qtyRequested:3000,qtyDispatched:3000,qtyReceived:3000,uom:"pcs",fromBin:null,toBin:null}],remarks:"Monthly FG replenishment to Mumbai DC",createdAt:"2026-01-24T10:00:00.000Z"},
  { id:"trf-002",ref:"TRF-002",fromLocationId:"loc-1",toLocationId:"loc-2",status:"received",dispatchDate:"2026-02-22",expectedArrival:"2026-02-25",receivedDate:"2026-02-24",lines:[{itemId:"fg-006",qtyRequested:2000,qtyDispatched:2000,qtyReceived:2000,uom:"pcs",fromBin:null,toBin:null}],remarks:"Rice Flour stock transfer",createdAt:"2026-02-21T10:00:00.000Z"},
  { id:"trf-003",ref:"TRF-003",fromLocationId:"loc-1",toLocationId:"loc-2",status:"received",dispatchDate:"2026-03-20",expectedArrival:"2026-03-23",receivedDate:"2026-03-22",lines:[{itemId:"fg-017",qtyRequested:2500,qtyDispatched:2500,qtyReceived:2500,uom:"pcs",fromBin:null,toBin:null}],remarks:"Kitchen King spice mix transfer",createdAt:"2026-03-19T10:00:00.000Z"},
  { id:"trf-004",ref:"TRF-004",fromLocationId:"loc-1",toLocationId:"loc-2",status:"received",dispatchDate:"2026-04-18",expectedArrival:"2026-04-21",receivedDate:"2026-04-20",lines:[{itemId:"fg-001",qtyRequested:4000,qtyDispatched:4000,qtyReceived:4000,uom:"pcs",fromBin:null,toBin:null}],remarks:"Atta April replenishment",createdAt:"2026-04-17T10:00:00.000Z"},
  { id:"trf-005",ref:"TRF-005",fromLocationId:"loc-1",toLocationId:"loc-2",status:"received",dispatchDate:"2026-05-16",expectedArrival:"2026-05-19",receivedDate:"2026-05-18",lines:[{itemId:"fg-044",qtyRequested:1500,qtyDispatched:1500,qtyReceived:1500,uom:"pcs",fromBin:null,toBin:null}],remarks:"Sunflower Oil transfer",createdAt:"2026-05-15T10:00:00.000Z"},
  { id:"trf-006",ref:"TRF-006",fromLocationId:"loc-1",toLocationId:"loc-2",status:"received",dispatchDate:"2026-06-12",expectedArrival:"2026-06-15",receivedDate:"2026-06-14",lines:[{itemId:"fg-001",qtyRequested:2500,qtyDispatched:2500,qtyReceived:2500,uom:"pcs",fromBin:null,toBin:null}],remarks:"June atta replenishment",createdAt:"2026-06-11T10:00:00.000Z"},
  { id:"trf-007",ref:"TRF-007",fromLocationId:"loc-2",toLocationId:"loc-5",status:"received",dispatchDate:"2026-02-15",expectedArrival:"2026-02-18",receivedDate:"2026-02-17",lines:[{itemId:"fg-001",qtyRequested:1000,qtyDispatched:1000,qtyReceived:1000,uom:"pcs",fromBin:null,toBin:null}],remarks:"Chennai depot replenishment",createdAt:"2026-02-14T10:00:00.000Z"},
  { id:"trf-008",ref:"TRF-008",fromLocationId:"loc-2",toLocationId:"loc-5",status:"received",dispatchDate:"2026-04-10",expectedArrival:"2026-04-13",receivedDate:"2026-04-12",lines:[{itemId:"fg-017",qtyRequested:800,qtyDispatched:800,qtyReceived:800,uom:"pcs",fromBin:null,toBin:null}],remarks:"Spice mix for Chennai",createdAt:"2026-04-09T10:00:00.000Z"},
  { id:"trf-009",ref:"TRF-009",fromLocationId:"loc-2",toLocationId:"loc-5",status:"in-transit",dispatchDate:"2026-06-05",expectedArrival:"2026-06-08",receivedDate:null,lines:[{itemId:"fg-001",qtyRequested:1200,qtyDispatched:1200,qtyReceived:0,uom:"pcs",fromBin:null,toBin:null}],remarks:"June Chennai shipment",createdAt:"2026-06-04T10:00:00.000Z"},
  { id:"trf-010",ref:"TRF-010",fromLocationId:"loc-1",toLocationId:"loc-7",status:"received",dispatchDate:"2026-03-10",expectedArrival:"2026-03-14",receivedDate:"2026-03-13",lines:[{itemId:"fg-001",qtyRequested:2000,qtyDispatched:2000,qtyReceived:2000,uom:"pcs",fromBin:null,toBin:null}],remarks:"Kolkata/Export hub stocking",createdAt:"2026-03-09T10:00:00.000Z"},
  { id:"trf-011",ref:"TRF-011",fromLocationId:"loc-1",toLocationId:"loc-7",status:"received",dispatchDate:"2026-05-08",expectedArrival:"2026-05-12",receivedDate:"2026-05-11",lines:[{itemId:"fg-017",qtyRequested:1500,qtyDispatched:1500,qtyReceived:1500,uom:"pcs",fromBin:null,toBin:null}],remarks:"Export spice mixes to Kolkata",createdAt:"2026-05-07T10:00:00.000Z"},
  { id:"trf-012",ref:"TRF-012",fromLocationId:"loc-1",toLocationId:"loc-6",status:"received",dispatchDate:"2026-03-15",expectedArrival:"2026-03-18",receivedDate:"2026-03-17",lines:[{itemId:"fg-001",qtyRequested:1500,qtyDispatched:1500,qtyReceived:1500,uom:"pcs",fromBin:null,toBin:null},{itemId:"fg-017",qtyRequested:1000,qtyDispatched:1000,qtyReceived:1000,uom:"pcs",fromBin:null,toBin:null}],remarks:"Hyderabad depot first stock",createdAt:"2026-03-14T10:00:00.000Z"},
  { id:"trf-013",ref:"TRF-013",fromLocationId:"loc-1",toLocationId:"loc-6",status:"received",dispatchDate:"2026-05-20",expectedArrival:"2026-05-23",receivedDate:"2026-05-22",lines:[{itemId:"fg-001",qtyRequested:2000,qtyDispatched:2000,qtyReceived:2000,uom:"pcs",fromBin:null,toBin:null}],remarks:"Hyderabad May top-up",createdAt:"2026-05-19T10:00:00.000Z"},
  { id:"trf-014",ref:"TRF-014",fromLocationId:"loc-8",toLocationId:"loc-4",status:"received",dispatchDate:"2026-02-01",expectedArrival:"2026-02-03",receivedDate:"2026-02-02",lines:[{itemId:"pm-001",qtyRequested:200,qtyDispatched:200,qtyReceived:200,uom:"kg",fromBin:null,toBin:null},{itemId:"pm-013",qtyRequested:3000,qtyDispatched:3000,qtyReceived:3000,uom:"pcs",fromBin:null,toBin:null}],remarks:"Packaging materials to Pune factory",createdAt:"2026-01-31T10:00:00.000Z"},
  { id:"trf-015",ref:"TRF-015",fromLocationId:"loc-8",toLocationId:"loc-4",status:"received",dispatchDate:"2026-04-05",expectedArrival:"2026-04-07",receivedDate:"2026-04-06",lines:[{itemId:"pm-004",qtyRequested:150,qtyDispatched:150,qtyReceived:150,uom:"kg",fromBin:null,toBin:null},{itemId:"pm-020",qtyRequested:2000,qtyDispatched:2000,qtyReceived:2000,uom:"pcs",fromBin:null,toBin:null}],remarks:"April PM to Pune",createdAt:"2026-04-04T10:00:00.000Z"},
];

// â”€â”€ GOODS RECEIPT NOTES (25) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEMO_GRNS: GoodsReceiptNote[] = [
  { id:"grn-001",ref:"GRN-001",date:"2026-01-08",vendorName:"Sterling Grains Pvt Ltd",poRef:"PO-001",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-001",qty:5000,unitPrice:21.5,batchNo:"BT-2601"},{itemId:"rm-002",qty:3000,unitPrice:27.8,batchNo:"BT-2602"}],note:"All bags inspected; no damage",status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-01-08",verdict:"passed",lines:[{itemId:"rm-001",acceptedQty:5000,rejectedQty:0},{itemId:"rm-002",acceptedQty:3000,rejectedQty:0}]}},
  { id:"grn-002",ref:"GRN-002",date:"2026-01-10",vendorName:"BlueOcean Packaging",poRef:"PO-002",locationId:"loc-8",receivedBy:"emp-082",lines:[{itemId:"pm-001",qty:300,unitPrice:144},{itemId:"pm-004",qty:200,unitPrice:194},{itemId:"pm-013",qty:5000,unitPrice:3.2}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-01-10",verdict:"passed",lines:[{itemId:"pm-001",acceptedQty:300,rejectedQty:0},{itemId:"pm-004",acceptedQty:200,rejectedQty:0},{itemId:"pm-013",acceptedQty:5000,rejectedQty:0}]}},
  { id:"grn-003",ref:"GRN-003",date:"2026-01-12",vendorName:"Sunrise Spice Traders",poRef:"PO-003",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-011",qty:400,unitPrice:138},{itemId:"rm-013",qty:600,unitPrice:89}],status:"posted",qcResult:{inspectedBy:"emp-089",inspectedDate:"2026-01-12",verdict:"passed",lines:[{itemId:"rm-011",acceptedQty:400,rejectedQty:0},{itemId:"rm-013",acceptedQty:600,rejectedQty:0}]}},
  { id:"grn-004",ref:"GRN-004",date:"2026-01-14",vendorName:"Nature's Best Organics",poRef:"PO-004",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-026",qty:1000,unitPrice:94}],status:"posted",qcResult:{inspectedBy:"emp-089",inspectedDate:"2026-01-15",verdict:"passed",lines:[{itemId:"rm-026",acceptedQty:1000,rejectedQty:0}]}},
  { id:"grn-005",ref:"GRN-005",date:"2026-01-20",vendorName:"Vishnu Agro Traders",poRef:"PO-005",locationId:"loc-4",receivedBy:"emp-083",lines:[{itemId:"rm-006",qty:2000,unitPrice:19.5},{itemId:"rm-027",qty:600,unitPrice:108}],status:"posted",qcResult:{inspectedBy:"emp-089",inspectedDate:"2026-01-20",verdict:"passed",lines:[{itemId:"rm-006",acceptedQty:2000,rejectedQty:0},{itemId:"rm-027",acceptedQty:600,rejectedQty:0}]}},
  { id:"grn-006",ref:"GRN-006",date:"2026-02-05",vendorName:"Sterling Grains Pvt Ltd",poRef:"PO-006",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-001",qty:6000,unitPrice:22,batchNo:"BT-2603"},{itemId:"rm-002",qty:4000,unitPrice:28,batchNo:"BT-2604"}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-02-06",verdict:"passed",lines:[{itemId:"rm-001",acceptedQty:6000,rejectedQty:0},{itemId:"rm-002",acceptedQty:4000,rejectedQty:0}]}},
  { id:"grn-007",ref:"GRN-007",date:"2026-02-07",vendorName:"BlueOcean Packaging",poRef:"PO-007",locationId:"loc-8",receivedBy:"emp-082",lines:[{itemId:"pm-001",qty:350,unitPrice:145},{itemId:"pm-013",qty:6000,unitPrice:3.2},{itemId:"pm-017",qty:3000,unitPrice:12}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-02-07",verdict:"passed",lines:[{itemId:"pm-001",acceptedQty:350,rejectedQty:0},{itemId:"pm-013",acceptedQty:6000,rejectedQty:0},{itemId:"pm-017",acceptedQty:3000,rejectedQty:0}]}},
  { id:"grn-008",ref:"GRN-008",date:"2026-02-10",vendorName:"Nature's Best Organics",poRef:"PO-008",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-026",qty:1200,unitPrice:95},{itemId:"rm-027",qty:800,unitPrice:110}],status:"posted",qcResult:{inspectedBy:"emp-089",inspectedDate:"2026-02-10",verdict:"passed",lines:[{itemId:"rm-026",acceptedQty:1200,rejectedQty:0},{itemId:"rm-027",acceptedQty:800,rejectedQty:0}]}},
  { id:"grn-009",ref:"GRN-009",date:"2026-03-04",vendorName:"Pioneer Seeds & Agro",poRef:"PO-009",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-001",qty:7000,unitPrice:22.5,batchNo:"BT-2605"},{itemId:"rm-013",qty:800,unitPrice:88}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-03-05",verdict:"passed",lines:[{itemId:"rm-001",acceptedQty:7000,rejectedQty:0},{itemId:"rm-013",acceptedQty:800,rejectedQty:0}]}},
  { id:"grn-010",ref:"GRN-010",date:"2026-03-06",vendorName:"Flex Pack India Pvt Ltd",poRef:"PO-010",locationId:"loc-8",receivedBy:"emp-082",lines:[{itemId:"pm-004",qty:250,unitPrice:194},{itemId:"pm-017",qty:4000,unitPrice:12}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-03-06",verdict:"passed",lines:[{itemId:"pm-004",acceptedQty:250,rejectedQty:0},{itemId:"pm-017",acceptedQty:4000,rejectedQty:0}]}},
  { id:"grn-011",ref:"GRN-011",date:"2026-03-10",vendorName:"Nature's Best Organics",poRef:"PO-011",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-026",qty:1500,unitPrice:95},{itemId:"rm-006",qty:2500,unitPrice:19.5}],status:"posted",qcResult:{inspectedBy:"emp-089",inspectedDate:"2026-03-11",verdict:"passed",lines:[{itemId:"rm-026",acceptedQty:1500,rejectedQty:0},{itemId:"rm-006",acceptedQty:2500,rejectedQty:0}]}},
  { id:"grn-012",ref:"GRN-012",date:"2026-04-05",vendorName:"Sterling Grains Pvt Ltd",poRef:"PO-012",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-001",qty:8000,unitPrice:22,batchNo:"BT-2606"},{itemId:"rm-002",qty:5000,unitPrice:28,batchNo:"BT-2607"}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-04-06",verdict:"passed",lines:[{itemId:"rm-001",acceptedQty:8000,rejectedQty:0},{itemId:"rm-002",acceptedQty:5000,rejectedQty:0}]}},
  { id:"grn-013",ref:"GRN-013",date:"2026-04-08",vendorName:"SkyPack Solutions",poRef:"PO-013",locationId:"loc-8",receivedBy:"emp-082",lines:[{itemId:"pm-001",qty:400,unitPrice:145},{itemId:"pm-013",qty:8000,unitPrice:3.2}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-04-08",verdict:"passed",lines:[{itemId:"pm-001",acceptedQty:400,rejectedQty:0},{itemId:"pm-013",acceptedQty:8000,rejectedQty:0}]}},
  { id:"grn-014",ref:"GRN-014",date:"2026-04-10",vendorName:"Vishnu Agro Traders",poRef:"PO-014",locationId:"loc-4",receivedBy:"emp-083",lines:[{itemId:"rm-027",qty:1000,unitPrice:110}],status:"posted",qcResult:{inspectedBy:"emp-089",inspectedDate:"2026-04-10",verdict:"passed",lines:[{itemId:"rm-027",acceptedQty:1000,rejectedQty:0}]}},
  { id:"grn-015",ref:"GRN-015",date:"2026-05-06",vendorName:"Pioneer Seeds & Agro",poRef:"PO-015",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-001",qty:9000,unitPrice:22.5,batchNo:"BT-2608"},{itemId:"rm-002",qty:6000,unitPrice:28.5,batchNo:"BT-2609"}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-05-07",verdict:"passed",lines:[{itemId:"rm-001",acceptedQty:9000,rejectedQty:0},{itemId:"rm-002",acceptedQty:6000,rejectedQty:0}]}},
  { id:"grn-016",ref:"GRN-016",date:"2026-05-08",vendorName:"BlueOcean Packaging",poRef:"PO-016",locationId:"loc-8",receivedBy:"emp-082",lines:[{itemId:"pm-001",qty:500,unitPrice:145},{itemId:"pm-017",qty:5000,unitPrice:12}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-05-08",verdict:"partial",remarks:"25 pm-017 jars had hairline cracks",lines:[{itemId:"pm-001",acceptedQty:500,rejectedQty:0},{itemId:"pm-017",acceptedQty:4975,rejectedQty:25,rejectionReason:"Hairline cracks on lid rim"}]}},
  { id:"grn-017",ref:"GRN-017",date:"2026-05-10",vendorName:"Nature's Best Organics",poRef:"PO-017",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-026",qty:2000,unitPrice:96}],status:"posted",qcResult:{inspectedBy:"emp-089",inspectedDate:"2026-05-10",verdict:"passed",lines:[{itemId:"rm-026",acceptedQty:2000,rejectedQty:0}]}},
  { id:"grn-018",ref:"GRN-018",date:"2026-06-04",vendorName:"Sterling Grains Pvt Ltd",poRef:"PO-018",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-001",qty:7000,unitPrice:23,batchNo:"BT-2610"},{itemId:"rm-002",qty:4500,unitPrice:29,batchNo:"BT-2611"}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-06-05",verdict:"passed",lines:[{itemId:"rm-001",acceptedQty:7000,rejectedQty:0},{itemId:"rm-002",acceptedQty:4500,rejectedQty:0}]}},
  { id:"grn-019",ref:"GRN-019",date:"2026-06-06",vendorName:"Flex Pack India Pvt Ltd",poRef:"PO-019",locationId:"loc-8",receivedBy:"emp-082",lines:[{itemId:"pm-001",qty:400,unitPrice:145},{itemId:"pm-013",qty:7000,unitPrice:3.2}],status:"posted",qcResult:{inspectedBy:"emp-088",inspectedDate:"2026-06-06",verdict:"passed",lines:[{itemId:"pm-001",acceptedQty:400,rejectedQty:0},{itemId:"pm-013",acceptedQty:7000,rejectedQty:0}]}},
  { id:"grn-020",ref:"GRN-020",date:"2026-06-08",vendorName:"Nature's Best Organics",poRef:"PO-020",locationId:"loc-1",receivedBy:"emp-074",lines:[{itemId:"rm-026",qty:1800,unitPrice:96}],status:"posted",qcResult:{inspectedBy:"emp-089",inspectedDate:"2026-06-08",verdict:"passed",lines:[{itemId:"rm-026",acceptedQty:1800,rejectedQty:0}]}},
];

// â”€â”€ PURCHASE ORDERS (40) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEMO_POS: PurchaseOrder[] = [
  // Jan
  {id:"po-001",vendorId:"ven-01",title:"Wheat & Rice â€” Jan 2026",date:"2026-01-05",lines:[{item:"Wheat Grain",qty:5000,unitPrice:21.5,itemId:"rm-001"},{item:"Rice Paddy",qty:3000,unitPrice:27.8,itemId:"rm-002"}],total:214500,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"SG/2026/01",date:"2026-01-08",amount:252810},payMode:"bank",paidOn:"2026-01-25"},
  {id:"po-002",vendorId:"ven-07",title:"BOPP Film & Pouches â€” Jan",date:"2026-01-07",lines:[{item:"BOPP Film Roll",qty:300,unitPrice:144,itemId:"pm-001"},{item:"Multilayer Film",qty:200,unitPrice:194,itemId:"pm-004"},{item:"Stand-up Pouch 500g",qty:5000,unitPrice:3.2,itemId:"pm-013"}],total:93400,spocId:"emp-069",entityId:"ent-1",locationId:"loc-8",status:"paid",invoice:{number:"BO/2026/011",date:"2026-01-10",amount:110212},payMode:"bank",paidOn:"2026-02-05"},
  {id:"po-003",vendorId:"ven-05",title:"Spices â€” Jan 2026",date:"2026-01-09",lines:[{item:"Turmeric Powder",qty:400,unitPrice:138,itemId:"rm-011"},{item:"Coriander Seeds",qty:600,unitPrice:89,itemId:"rm-013"}],total:108600,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"SS/2026/JAN01",date:"2026-01-12",amount:128148},payMode:"bank",paidOn:"2026-02-01"},
  {id:"po-004",vendorId:"ven-04",title:"Crude Oils â€” Jan",date:"2026-01-11",lines:[{item:"Crude Sunflower Oil",qty:1000,unitPrice:94,itemId:"rm-026"}],total:94000,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"NBO/26/101",date:"2026-01-14",amount:110920},payMode:"bank",paidOn:"2026-02-10"},
  {id:"po-005",vendorId:"ven-03",title:"Maize & Mustard Oil â€” Pune Jan",date:"2026-01-17",lines:[{item:"Maize / Corn",qty:2000,unitPrice:19.5,itemId:"rm-006"},{item:"Crude Mustard Oil",qty:600,unitPrice:108,itemId:"rm-027"}],total:103800,spocId:"emp-069",entityId:"ent-1",locationId:"loc-4",status:"paid",invoice:{number:"VAT/2026/01",date:"2026-01-20",amount:122484},payMode:"upi",paidOn:"2026-02-08"},
  // Feb
  {id:"po-006",vendorId:"ven-01",title:"Wheat & Rice â€” Feb 2026",date:"2026-02-01",lines:[{item:"Wheat Grain",qty:6000,unitPrice:22,itemId:"rm-001"},{item:"Rice Paddy",qty:4000,unitPrice:28,itemId:"rm-002"}],total:244000,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"SG/2026/02",date:"2026-02-05",amount:287920},payMode:"bank",paidOn:"2026-02-25"},
  {id:"po-007",vendorId:"ven-07",title:"Packaging â€” Feb",date:"2026-02-03",lines:[{item:"BOPP Film Roll",qty:350,unitPrice:145,itemId:"pm-001"},{item:"Stand-up Pouch 500g",qty:6000,unitPrice:3.2,itemId:"pm-013"},{item:"PET Jar 500g",qty:3000,unitPrice:12,itemId:"pm-017"}],total:106975,spocId:"emp-069",entityId:"ent-1",locationId:"loc-8",status:"paid",invoice:{number:"BO/2026/012",date:"2026-02-07",amount:126230},payMode:"bank",paidOn:"2026-03-01"},
  {id:"po-008",vendorId:"ven-04",title:"Oils â€” Feb",date:"2026-02-06",lines:[{item:"Crude Sunflower Oil",qty:1200,unitPrice:95,itemId:"rm-026"},{item:"Crude Mustard Oil",qty:800,unitPrice:110,itemId:"rm-027"}],total:202000,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"NBO/26/102",date:"2026-02-10",amount:238360},payMode:"bank",paidOn:"2026-03-05"},
  {id:"po-009",vendorId:"ven-02",title:"Grains â€” Mar 2026",date:"2026-03-01",lines:[{item:"Wheat Grain",qty:7000,unitPrice:22.5,itemId:"rm-001"},{item:"Coriander Seeds",qty:800,unitPrice:88,itemId:"rm-013"}],total:228000,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"PSA/2026/03",date:"2026-03-04",amount:268440},payMode:"bank",paidOn:"2026-03-25"},
  {id:"po-010",vendorId:"ven-08",title:"Packaging Films â€” Mar",date:"2026-03-03",lines:[{item:"Multilayer Barrier Film",qty:250,unitPrice:194,itemId:"pm-004"},{item:"PET Jar 500g",qty:4000,unitPrice:12,itemId:"pm-017"}],total:96500,spocId:"emp-069",entityId:"ent-1",locationId:"loc-8",status:"paid",invoice:{number:"FPI/2026/031",date:"2026-03-06",amount:113870},payMode:"bank",paidOn:"2026-04-01"},
  {id:"po-011",vendorId:"ven-04",title:"Oils & Maize â€” Mar",date:"2026-03-06",lines:[{item:"Crude Sunflower Oil",qty:1500,unitPrice:95,itemId:"rm-026"},{item:"Maize / Corn",qty:2500,unitPrice:19.5,itemId:"rm-006"}],total:191250,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"NBO/26/103",date:"2026-03-10",amount:225675},payMode:"bank",paidOn:"2026-04-05"},
  {id:"po-012",vendorId:"ven-01",title:"Wheat & Rice â€” Apr 2026",date:"2026-04-01",lines:[{item:"Wheat Grain",qty:8000,unitPrice:22,itemId:"rm-001"},{item:"Rice Paddy",qty:5000,unitPrice:28,itemId:"rm-002"}],total:316000,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"invoiced",invoice:{number:"SG/2026/04",date:"2026-04-05",amount:372880},payMode:"bank"},
  {id:"po-013",vendorId:"ven-09",title:"Packaging â€” Apr",date:"2026-04-04",lines:[{item:"BOPP Film Roll",qty:400,unitPrice:145,itemId:"pm-001"},{item:"Stand-up Pouch 500g",qty:8000,unitPrice:3.2,itemId:"pm-013"}],total:83600,spocId:"emp-069",entityId:"ent-1",locationId:"loc-8",status:"invoiced",invoice:{number:"SKP/2026/041",date:"2026-04-08",amount:98648},payMode:"bank"},
  {id:"po-014",vendorId:"ven-03",title:"Mustard Oil â€” Pune Apr",date:"2026-04-07",lines:[{item:"Crude Mustard Oil",qty:1000,unitPrice:110,itemId:"rm-027"}],total:110000,spocId:"emp-069",entityId:"ent-1",locationId:"loc-4",status:"paid",invoice:{number:"VAT/2026/04",date:"2026-04-10",amount:129800},payMode:"upi",paidOn:"2026-04-30"},
  {id:"po-015",vendorId:"ven-02",title:"Grains â€” May 2026",date:"2026-05-02",lines:[{item:"Wheat Grain",qty:9000,unitPrice:22.5,itemId:"rm-001"},{item:"Rice Paddy",qty:6000,unitPrice:28.5,itemId:"rm-002"}],total:373500,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"invoiced",invoice:{number:"PSA/2026/05",date:"2026-05-06",amount:440730},payMode:"bank"},
  {id:"po-016",vendorId:"ven-07",title:"Packaging â€” May",date:"2026-05-04",lines:[{item:"BOPP Film Roll",qty:500,unitPrice:145,itemId:"pm-001"},{item:"PET Jar 500g",qty:5000,unitPrice:12,itemId:"pm-017"}],total:132500,spocId:"emp-069",entityId:"ent-1",locationId:"loc-8",status:"invoiced",invoice:{number:"BO/2026/013",date:"2026-05-08",amount:156350},payMode:"bank"},
  {id:"po-017",vendorId:"ven-04",title:"Sunflower Oil â€” May",date:"2026-05-07",lines:[{item:"Crude Sunflower Oil",qty:2000,unitPrice:96,itemId:"rm-026"}],total:192000,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"invoiced",invoice:{number:"NBO/26/104",date:"2026-05-10",amount:226560},payMode:"bank"},
  {id:"po-018",vendorId:"ven-01",title:"Wheat & Rice â€” Jun 2026",date:"2026-06-01",lines:[{item:"Wheat Grain",qty:7000,unitPrice:23,itemId:"rm-001"},{item:"Rice Paddy",qty:4500,unitPrice:29,itemId:"rm-002"}],total:291500,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"invoiced",invoice:{number:"SG/2026/06",date:"2026-06-04",amount:343970},payMode:"bank"},
  {id:"po-019",vendorId:"ven-08",title:"Packaging â€” Jun",date:"2026-06-03",lines:[{item:"BOPP Film Roll",qty:400,unitPrice:145,itemId:"pm-001"},{item:"Stand-up Pouch 500g",qty:7000,unitPrice:3.2,itemId:"pm-013"}],total:80400,spocId:"emp-069",entityId:"ent-1",locationId:"loc-8",status:"issued"},
  {id:"po-020",vendorId:"ven-04",title:"Sunflower Oil â€” Jun",date:"2026-06-05",lines:[{item:"Crude Sunflower Oil",qty:1800,unitPrice:96,itemId:"rm-026"}],total:172800,spocId:"emp-068",entityId:"ent-1",locationId:"loc-1",status:"invoiced",invoice:{number:"NBO/26/105",date:"2026-06-08",amount:203904},payMode:"bank"},
  // Opex POs
  {id:"po-021",vendorId:"ven-11",title:"Logistics Jan-Feb",date:"2026-01-02",lines:[{item:"Freight & Delivery Charges",qty:1,unitPrice:350000}],total:350000,spocId:"emp-079",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"SWL/2026/01",date:"2026-01-31",amount:413000},payMode:"bank",paidOn:"2026-02-15"},
  {id:"po-022",vendorId:"ven-12",title:"BlueDart Express â€” Q1",date:"2026-01-05",lines:[{item:"Courier & Express Delivery",qty:1,unitPrice:180000}],total:180000,spocId:"emp-079",entityId:"ent-2",locationId:"loc-2",status:"paid",invoice:{number:"BD/2601/ENT2",date:"2026-01-31",amount:212400},payMode:"bank",paidOn:"2026-02-20"},
  {id:"po-023",vendorId:"ven-14",title:"TechSoft ERP Subscription Q1",date:"2026-01-02",lines:[{item:"ERP SaaS License â€” Q1 2026",qty:3,unitPrice:85000}],total:255000,spocId:"emp-074",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"TS/Q1/2026",date:"2026-01-05",amount:300900},payMode:"bank",paidOn:"2026-01-15"},
  {id:"po-024",vendorId:"ven-15",title:"CloudBase â€” AWS Managed Services",date:"2026-01-03",lines:[{item:"Cloud Infra Management â€” Jan-Mar",qty:1,unitPrice:120000}],total:120000,spocId:"emp-074",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"CB/2026/001",date:"2026-03-31",amount:141600},payMode:"bank",paidOn:"2026-04-15"},
  {id:"po-025",vendorId:"ven-18",title:"Office Lease â€” Bengaluru HQ Q1",date:"2026-01-01",lines:[{item:"Office Rent Jan-Mar 2026",qty:3,unitPrice:500000}],total:1500000,spocId:"emp-002",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"POS/2026/Q1",date:"2026-01-01",amount:1770000},payMode:"bank",paidOn:"2026-01-10"},
  {id:"po-026",vendorId:"ven-18",title:"Office Lease â€” Bengaluru HQ Q2",date:"2026-04-01",lines:[{item:"Office Rent Apr-Jun 2026",qty:3,unitPrice:500000}],total:1500000,spocId:"emp-002",entityId:"ent-1",locationId:"loc-1",status:"invoiced",invoice:{number:"POS/2026/Q2",date:"2026-04-01",amount:1770000},payMode:"bank"},
  {id:"po-027",vendorId:"ven-16",title:"Brand Campaign â€” Summer 2026",date:"2026-03-15",lines:[{item:"Digital + OOH Campaign Q2",qty:1,unitPrice:800000}],total:800000,spocId:"emp-031",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"BW/2026/003",date:"2026-04-01",amount:944000},payMode:"bank",paidOn:"2026-04-20"},
  {id:"po-028",vendorId:"ven-17",title:"Performance Marketing â€” Apr-Jun",date:"2026-04-01",lines:[{item:"Google & Meta Ad Spend Management",qty:3,unitPrice:250000}],total:750000,spocId:"emp-034",entityId:"ent-2",locationId:"loc-2",status:"invoiced",invoice:{number:"DR/2026/04",date:"2026-06-30",amount:885000},payMode:"bank"},
  {id:"po-029",vendorId:"ven-19",title:"Facility Management â€” Mumbai",date:"2026-01-01",lines:[{item:"Housekeeping & Maintenance Q1",qty:3,unitPrice:120000}],total:360000,spocId:"emp-079",entityId:"ent-2",locationId:"loc-2",status:"paid",invoice:{number:"CP/2026/01",date:"2026-03-31",amount:424800},payMode:"bank",paidOn:"2026-04-10"},
  {id:"po-030",vendorId:"ven-20",title:"Security Services â€” All Plants Q1",date:"2026-01-01",lines:[{item:"Security Guards â€” 3 Sites",qty:3,unitPrice:200000}],total:600000,spocId:"emp-003",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"SSI/Q1/2026",date:"2026-03-31",amount:708000},payMode:"bank",paidOn:"2026-04-12"},
  // Capex POs
  {id:"po-031",vendorId:"ven-21",title:"Auto-packing Line â€” Pune",date:"2026-01-10",lines:[{item:"Robotic Packing Machine Model RP-500",qty:1,unitPrice:3500000}],total:3500000,spocId:"emp-003",entityId:"ent-1",locationId:"loc-4",status:"paid",invoice:{number:"RP/2026/001",date:"2026-01-20",amount:4130000},payMode:"bank",paidOn:"2026-02-28"},
  {id:"po-032",vendorId:"ven-22",title:"Flour Mill Upgrade â€” Bengaluru",date:"2026-02-01",lines:[{item:"High-capacity Flour Mill Roller",qty:2,unitPrice:1200000}],total:2400000,spocId:"emp-003",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"MEW/2026/002",date:"2026-03-01",amount:2832000},payMode:"bank",paidOn:"2026-03-25"},
  {id:"po-033",vendorId:"ven-23",title:"Office Furniture â€” Delhi Hub",date:"2026-01-15",lines:[{item:"Workstations and Chairs â€” 20 sets",qty:20,unitPrice:45000}],total:900000,spocId:"emp-005",entityId:"ent-3",locationId:"loc-3",status:"paid",invoice:{number:"OSF/2026/01",date:"2026-01-20",amount:1062000},payMode:"bank",paidOn:"2026-02-15"},
  {id:"po-034",vendorId:"ven-24",title:"Printers & Scanners",date:"2026-01-20",lines:[{item:"Canon imagePROGRAF Printer",qty:3,unitPrice:85000},{item:"Canon DR Scanner",qty:5,unitPrice:35000}],total:430000,spocId:"emp-074",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"CI/2026/0134",date:"2026-01-25",amount:507400},payMode:"bank",paidOn:"2026-02-20"},
  // Opex â€” Q2
  {id:"po-035",vendorId:"ven-11",title:"Logistics Mar-Apr",date:"2026-03-01",lines:[{item:"Freight & Delivery Charges",qty:1,unitPrice:420000}],total:420000,spocId:"emp-079",entityId:"ent-1",locationId:"loc-1",status:"paid",invoice:{number:"SWL/2026/03",date:"2026-04-30",amount:495600},payMode:"bank",paidOn:"2026-05-20"},
  {id:"po-036",vendorId:"ven-11",title:"Logistics May-Jun",date:"2026-05-01",lines:[{item:"Freight & Delivery Charges",qty:1,unitPrice:450000}],total:450000,spocId:"emp-079",entityId:"ent-1",locationId:"loc-1",status:"invoiced",invoice:{number:"SWL/2026/05",date:"2026-06-30",amount:531000},payMode:"bank"},
  {id:"po-037",vendorId:"ven-13",title:"Road Transport â€” Export Hub",date:"2026-02-01",lines:[{item:"Delhi-Port-Delhi Transport Q1",qty:1,unitPrice:280000}],total:280000,spocId:"emp-086",entityId:"ent-3",locationId:"loc-3",status:"paid",invoice:{number:"RRT/2026/02",date:"2026-03-31",amount:330400},payMode:"bank",paidOn:"2026-04-15"},
  {id:"po-038",vendorId:"ven-13",title:"Road Transport â€” Export Hub Q2",date:"2026-05-01",lines:[{item:"Delhi-Port-Delhi Transport Q2",qty:1,unitPrice:320000}],total:320000,spocId:"emp-086",entityId:"ent-3",locationId:"loc-3",status:"invoiced",invoice:{number:"RRT/2026/05",date:"2026-06-30",amount:377600},payMode:"bank"},
  {id:"po-039",vendorId:"ven-19",title:"Facility Mgmt Q2 â€” Mumbai",date:"2026-04-01",lines:[{item:"Housekeeping & Maintenance Q2",qty:3,unitPrice:125000}],total:375000,spocId:"emp-079",entityId:"ent-2",locationId:"loc-2",status:"invoiced",invoice:{number:"CP/2026/04",date:"2026-06-30",amount:442500},payMode:"bank"},
  {id:"po-040",vendorId:"ven-20",title:"Security Services Q2",date:"2026-04-01",lines:[{item:"Security Guards â€” 3 Sites",qty:3,unitPrice:210000}],total:630000,spocId:"emp-003",entityId:"ent-1",locationId:"loc-1",status:"invoiced",invoice:{number:"SSI/Q2/2026",date:"2026-06-30",amount:743400},payMode:"bank"},
];


// ── SALES INVOICES (60) ───────────────────────────────────────────────────────
const DEMO_INVOICES: Invoice[] = [
  // January 2026
  {id:"inv-001",number:"SAL-0001",accountId:"acc-01",entityId:"ent-1",date:"2026-01-18",dueDate:"2026-02-17",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:2000,rate:45,gstRate:0,itemId:"fg-001"},{desc:"Kitchen King 100g",hsn:"0910",qty:1200,rate:48,gstRate:12,itemId:"fg-017"}],discountType:"none",discountValue:0,notes:"FreshMart Jan Order",signatoryId:"emp-002"},
  {id:"inv-002",number:"SAL-0002",accountId:"acc-14",entityId:"ent-2",date:"2026-01-20",dueDate:"2026-02-19",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:1500,rate:45,gstRate:0,itemId:"fg-001"},{desc:"Basmati Rice 1kg",hsn:"1006",qty:800,rate:120,gstRate:0,itemId:"fg-011"}],discountType:"none",discountValue:0,notes:"D-Mart Jan supply",signatoryId:"emp-002"},
  {id:"inv-003",number:"SAL-0003",accountId:"acc-04",entityId:"ent-1",date:"2026-01-22",dueDate:"2026-02-21",status:"paid",lines:[{desc:"Garam Masala 50g",hsn:"0910",qty:1500,rate:55,gstRate:12,itemId:"fg-025"},{desc:"Mango Pickle 500g",hsn:"2001",qty:800,rate:95,gstRate:12,itemId:"fg-039"},{desc:"Sunflower Oil 1L",hsn:"1512",qty:600,rate:145,gstRate:5,itemId:"fg-044"}],discountType:"none",discountValue:0,notes:"Metro Hyderabad Jan",signatoryId:"emp-002"},
  {id:"inv-004",number:"SAL-0004",accountId:"acc-21",entityId:"ent-2",date:"2026-01-25",dueDate:"2026-02-24",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:3000,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Kitchen King 100g",hsn:"0910",qty:1800,rate:46,gstRate:12,itemId:"fg-017"}],discountType:"percent",discountValue:2,notes:"Bigbasket Jan — 2% trade discount",signatoryId:"emp-004"},
  {id:"inv-005",number:"SAL-0005",accountId:"acc-16",entityId:"ent-2",date:"2026-01-28",dueDate:"2026-02-27",status:"paid",lines:[{desc:"Wheat Atta 5kg",hsn:"1101",qty:400,rate:208,gstRate:0,itemId:"fg-002"},{desc:"Basmati Rice 5kg",hsn:"1006",qty:200,rate:570,gstRate:0,itemId:"fg-012"},{desc:"Multigrain Atta 1kg",hsn:"1101",qty:500,rate:78,gstRate:0,itemId:"fg-004"}],discountType:"none",discountValue:0,notes:"Reliance Fresh Jan",signatoryId:"emp-004"},
  // February 2026
  {id:"inv-006",number:"SAL-0006",accountId:"acc-01",entityId:"ent-1",date:"2026-02-15",dueDate:"2026-03-17",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:2500,rate:45,gstRate:0,itemId:"fg-001"},{desc:"Rice Flour 1kg",hsn:"1102",qty:2000,rate:55,gstRate:0,itemId:"fg-006"}],discountType:"none",discountValue:0,notes:"FreshMart Feb Order",signatoryId:"emp-002"},
  {id:"inv-007",number:"SAL-0007",accountId:"acc-13",entityId:"ent-2",date:"2026-02-17",dueDate:"2026-03-19",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:2000,rate:45,gstRate:0,itemId:"fg-001"},{desc:"Parboiled Rice 5kg",hsn:"1006",qty:600,rate:238,gstRate:0,itemId:"fg-013"}],discountType:"none",discountValue:0,notes:"BlueMart Feb",signatoryId:"emp-004"},
  {id:"inv-008",number:"SAL-0008",accountId:"acc-03",entityId:"ent-1",date:"2026-02-19",dueDate:"2026-03-21",status:"paid",lines:[{desc:"Kitchen King 100g",hsn:"0910",qty:1800,rate:48,gstRate:12,itemId:"fg-017"},{desc:"Chana Masala 100g",hsn:"0910",qty:1500,rate:42,gstRate:12,itemId:"fg-018"},{desc:"Mango Pickle 500g",hsn:"2001",qty:900,rate:95,gstRate:12,itemId:"fg-039"}],discountType:"none",discountValue:0,notes:"BigBazaar Feb Spices",signatoryId:"emp-002"},
  {id:"inv-009",number:"SAL-0009",accountId:"acc-15",entityId:"ent-2",date:"2026-02-22",dueDate:"2026-03-24",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:2500,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Sunflower Oil 1L",hsn:"1512",qty:800,rate:143,gstRate:5,itemId:"fg-044"}],discountType:"percent",discountValue:1.5,notes:"QuickKart Feb",signatoryId:"emp-004"},
  {id:"inv-010",number:"SAL-0010",accountId:"acc-24",entityId:"ent-3",date:"2026-02-25",dueDate:"2026-03-27",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:3000,rate:48,gstRate:0,itemId:"fg-001"},{desc:"Kitchen King 100g",hsn:"0910",qty:2000,rate:52,gstRate:0,itemId:"fg-017"},{desc:"Garam Masala 50g",hsn:"0910",qty:1500,rate:58,gstRate:0,itemId:"fg-025"}],discountType:"none",discountValue:0,notes:"Lulu UAE Feb Export",signatoryId:"emp-002",currency:"AED",fxRate:22.8},
  // March 2026
  {id:"inv-011",number:"SAL-0011",accountId:"acc-02",entityId:"ent-1",date:"2026-03-05",dueDate:"2026-04-04",status:"paid",lines:[{desc:"Multigrain Atta 1kg",hsn:"1101",qty:2000,rate:80,gstRate:0,itemId:"fg-004"},{desc:"Oats Granola 400g",hsn:"1904",qty:500,rate:185,gstRate:12,itemId:"fg-053"}],discountType:"none",discountValue:0,notes:"Nature's Basket Mar",signatoryId:"emp-002"},
  {id:"inv-012",number:"SAL-0012",accountId:"acc-21",entityId:"ent-2",date:"2026-03-10",dueDate:"2026-04-09",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:3500,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Rice Flour 1kg",hsn:"1102",qty:1500,rate:54,gstRate:0,itemId:"fg-006"},{desc:"Sunflower Oil 1L",hsn:"1512",qty:1200,rate:143,gstRate:5,itemId:"fg-044"}],discountType:"percent",discountValue:2,notes:"Bigbasket Mar",signatoryId:"emp-004"},
  {id:"inv-013",number:"SAL-0013",accountId:"acc-04",entityId:"ent-1",date:"2026-03-14",dueDate:"2026-04-13",status:"paid",lines:[{desc:"Kitchen King 100g",hsn:"0910",qty:2000,rate:48,gstRate:12,itemId:"fg-017"},{desc:"Biryani Masala 50g",hsn:"0910",qty:2500,rate:38,gstRate:12,itemId:"fg-019"},{desc:"Garam Masala 50g",hsn:"0910",qty:2000,rate:55,gstRate:12,itemId:"fg-025"}],discountType:"none",discountValue:0,notes:"Metro Mar Masalas",signatoryId:"emp-002"},
  {id:"inv-014",number:"SAL-0014",accountId:"acc-23",entityId:"ent-3",date:"2026-03-18",dueDate:"2026-04-17",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:5000,rate:47,gstRate:0,itemId:"fg-001"},{desc:"Sunflower Oil 1L",hsn:"1512",qty:2000,rate:148,gstRate:0,itemId:"fg-044"}],discountType:"none",discountValue:0,notes:"Al Adil UAE Mar Export",signatoryId:"emp-002",currency:"AED",fxRate:22.8},
  {id:"inv-015",number:"SAL-0015",accountId:"acc-17",entityId:"ent-2",date:"2026-03-22",dueDate:"2026-04-21",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:3000,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Multigrain Atta 1kg",hsn:"1101",qty:1000,rate:78,gstRate:0,itemId:"fg-004"},{desc:"Kitchen King 100g",hsn:"0910",qty:1500,rate:46,gstRate:12,itemId:"fg-017"}],discountType:"percent",discountValue:1,notes:"Swiggy Instamart Mar",signatoryId:"emp-004"},
  {id:"inv-016",number:"SAL-0016",accountId:"acc-16",entityId:"ent-2",date:"2026-03-28",dueDate:"2026-04-27",status:"paid",lines:[{desc:"Wheat Atta 5kg",hsn:"1101",qty:600,rate:208,gstRate:0,itemId:"fg-002"},{desc:"Sunflower Oil 5L",hsn:"1512",qty:300,rate:685,gstRate:5,itemId:"fg-045"},{desc:"Mustard Oil 1L",hsn:"1514",qty:800,rate:163,gstRate:5,itemId:"fg-046"}],discountType:"none",discountValue:0,notes:"Reliance Fresh Mar",signatoryId:"emp-004"},
  // April 2026
  {id:"inv-017",number:"SAL-0017",accountId:"acc-01",entityId:"ent-1",date:"2026-04-05",dueDate:"2026-05-05",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:3000,rate:45,gstRate:0,itemId:"fg-001"},{desc:"Kitchen King 100g",hsn:"0910",qty:2000,rate:48,gstRate:12,itemId:"fg-017"}],discountType:"none",discountValue:0,notes:"FreshMart Apr",signatoryId:"emp-002"},
  {id:"inv-018",number:"SAL-0018",accountId:"acc-14",entityId:"ent-2",date:"2026-04-08",dueDate:"2026-05-08",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:4000,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Basmati Rice 5kg",hsn:"1006",qty:400,rate:570,gstRate:0,itemId:"fg-012"}],discountType:"percent",discountValue:2,notes:"D-Mart Apr",signatoryId:"emp-004"},
  {id:"inv-019",number:"SAL-0019",accountId:"acc-20",entityId:"ent-2",date:"2026-04-12",dueDate:"2026-05-12",status:"paid",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:2500,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Rice Flour 1kg",hsn:"1102",qty:1000,rate:54,gstRate:0,itemId:"fg-006"},{desc:"Kitchen King 100g",hsn:"0910",qty:1200,rate:46,gstRate:12,itemId:"fg-017"}],discountType:"percent",discountValue:1.5,notes:"Blinkit Apr",signatoryId:"emp-004"},
  {id:"inv-020",number:"SAL-0020",accountId:"acc-24",entityId:"ent-3",date:"2026-04-15",dueDate:"2026-05-15",status:"partial",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:4000,rate:48,gstRate:0,itemId:"fg-001"},{desc:"Garam Masala 50g",hsn:"0910",qty:2000,rate:58,gstRate:0,itemId:"fg-025"},{desc:"Sunflower Oil 1L",hsn:"1512",qty:1500,rate:148,gstRate:0,itemId:"fg-044"}],discountType:"none",discountValue:0,notes:"Lulu Apr Export",signatoryId:"emp-002",currency:"AED",fxRate:22.8},
  {id:"inv-021",number:"SAL-0021",accountId:"acc-03",entityId:"ent-1",date:"2026-04-20",dueDate:"2026-05-20",status:"paid",lines:[{desc:"Sunflower Oil 1L",hsn:"1512",qty:1500,rate:145,gstRate:5,itemId:"fg-044"},{desc:"Mustard Oil 1L",hsn:"1514",qty:1200,rate:165,gstRate:5,itemId:"fg-046"}],discountType:"none",discountValue:0,notes:"BigBazaar Apr Oils",signatoryId:"emp-002"},
  {id:"inv-022",number:"SAL-0022",accountId:"acc-05",entityId:"ent-1",date:"2026-04-25",dueDate:"2026-05-25",status:"paid",lines:[{desc:"Rice Flour 1kg",hsn:"1102",qty:1500,rate:55,gstRate:0,itemId:"fg-006"},{desc:"Idli Mix 500g",hsn:"1901",qty:800,rate:70,gstRate:12,itemId:"fg-028"},{desc:"Dosa Mix 500g",hsn:"1901",qty:800,rate:75,gstRate:12,itemId:"fg-027"}],discountType:"none",discountValue:0,notes:"FoodWorld Chennai Apr",signatoryId:"emp-002"},
  // May 2026
  {id:"inv-023",number:"SAL-0023",accountId:"acc-21",entityId:"ent-2",date:"2026-05-05",dueDate:"2026-06-04",status:"sent",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:4500,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Sunflower Oil 1L",hsn:"1512",qty:1500,rate:143,gstRate:5,itemId:"fg-044"},{desc:"Kitchen King 100g",hsn:"0910",qty:2500,rate:46,gstRate:12,itemId:"fg-017"}],discountType:"percent",discountValue:2,notes:"Bigbasket May",signatoryId:"emp-004"},
  {id:"inv-024",number:"SAL-0024",accountId:"acc-16",entityId:"ent-2",date:"2026-05-09",dueDate:"2026-06-08",status:"sent",lines:[{desc:"Wheat Atta 5kg",hsn:"1101",qty:700,rate:208,gstRate:0,itemId:"fg-002"},{desc:"Multigrain Atta 1kg",hsn:"1101",qty:1200,rate:78,gstRate:0,itemId:"fg-004"},{desc:"Sunflower Oil 5L",hsn:"1512",qty:400,rate:685,gstRate:5,itemId:"fg-045"}],discountType:"none",discountValue:0,notes:"Reliance Fresh May",signatoryId:"emp-004"},
  {id:"inv-025",number:"SAL-0025",accountId:"acc-01",entityId:"ent-1",date:"2026-05-12",dueDate:"2026-06-11",status:"sent",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:3500,rate:45,gstRate:0,itemId:"fg-001"},{desc:"Garam Masala 50g",hsn:"0910",qty:2500,rate:55,gstRate:12,itemId:"fg-025"},{desc:"Mango Pickle 500g",hsn:"2001",qty:1200,rate:95,gstRate:12,itemId:"fg-039"}],discountType:"none",discountValue:0,notes:"FreshMart May",signatoryId:"emp-002"},
  {id:"inv-026",number:"SAL-0026",accountId:"acc-23",entityId:"ent-3",date:"2026-05-15",dueDate:"2026-06-14",status:"sent",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:5000,rate:48,gstRate:0,itemId:"fg-001"},{desc:"Kitchen King 100g",hsn:"0910",qty:3000,rate:52,gstRate:0,itemId:"fg-017"},{desc:"Sunflower Oil 1L",hsn:"1512",qty:2000,rate:148,gstRate:0,itemId:"fg-044"}],discountType:"none",discountValue:0,notes:"Al Adil May Export",signatoryId:"emp-002",currency:"AED",fxRate:22.8},
  {id:"inv-027",number:"SAL-0027",accountId:"acc-09",entityId:"ent-1",date:"2026-05-20",dueDate:"2026-06-19",status:"overdue",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:2000,rate:45,gstRate:0,itemId:"fg-001"},{desc:"Rice Flour 1kg",hsn:"1102",qty:1500,rate:55,gstRate:0,itemId:"fg-006"}],discountType:"none",discountValue:0,notes:"Heritage Foods May — OVERDUE",signatoryId:"emp-002"},
  {id:"inv-028",number:"SAL-0028",accountId:"acc-17",entityId:"ent-2",date:"2026-05-25",dueDate:"2026-06-24",status:"sent",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:3000,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Multigrain Atta 1kg",hsn:"1101",qty:1500,rate:78,gstRate:0,itemId:"fg-004"}],discountType:"percent",discountValue:1,notes:"Swiggy Instamart May",signatoryId:"emp-004"},
  // June 2026
  {id:"inv-029",number:"SAL-0029",accountId:"acc-14",entityId:"ent-2",date:"2026-06-03",dueDate:"2026-07-03",status:"sent",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:4000,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Sunflower Oil 1L",hsn:"1512",qty:1200,rate:143,gstRate:5,itemId:"fg-044"},{desc:"Kitchen King 100g",hsn:"0910",qty:2000,rate:46,gstRate:12,itemId:"fg-017"}],discountType:"percent",discountValue:2,notes:"D-Mart Jun",signatoryId:"emp-004"},
  {id:"inv-030",number:"SAL-0030",accountId:"acc-21",entityId:"ent-2",date:"2026-06-08",dueDate:"2026-07-08",status:"sent",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:4500,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Garam Masala 50g",hsn:"0910",qty:2000,rate:55,gstRate:12,itemId:"fg-025"}],discountType:"percent",discountValue:2,notes:"Bigbasket Jun",signatoryId:"emp-004"},
  {id:"inv-031",number:"SAL-0031",accountId:"acc-04",entityId:"ent-1",date:"2026-06-12",dueDate:"2026-07-12",status:"sent",lines:[{desc:"Kitchen King 100g",hsn:"0910",qty:2500,rate:48,gstRate:12,itemId:"fg-017"},{desc:"Biryani Masala 50g",hsn:"0910",qty:2000,rate:38,gstRate:12,itemId:"fg-019"},{desc:"Mango Pickle 500g",hsn:"2001",qty:1000,rate:95,gstRate:12,itemId:"fg-039"}],discountType:"none",discountValue:0,notes:"Metro Jun",signatoryId:"emp-002"},
  {id:"inv-032",number:"SAL-0032",accountId:"acc-25",entityId:"ent-3",date:"2026-06-15",dueDate:"2026-07-15",status:"sent",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:4000,rate:50,gstRate:0,itemId:"fg-001"},{desc:"Garam Masala 50g",hsn:"0910",qty:2500,rate:60,gstRate:0,itemId:"fg-025"}],discountType:"none",discountValue:0,notes:"NRI Bazaar USA Jun",signatoryId:"emp-002",currency:"USD",fxRate:83.5},
  {id:"inv-033",number:"SAL-0033",accountId:"acc-18",entityId:"ent-2",date:"2026-06-20",dueDate:"2026-07-20",status:"draft",lines:[{desc:"Wheat Atta 1kg",hsn:"1101",qty:3500,rate:44,gstRate:0,itemId:"fg-001"},{desc:"Rice Flour 1kg",hsn:"1102",qty:1500,rate:54,gstRate:0,itemId:"fg-006"}],discountType:"percent",discountValue:1.5,notes:"Zepto Jun — draft",signatoryId:"emp-004"},
];

// ── JOURNAL ENTRIES (GL Vouchers) ─────────────────────────────────────────────
const jv=(id:string,voucherNo:string,type:ManualEntry["type"],date:string,narration:string,entityId:string,locationId:string,basis:ManualEntry["basis"],lines:{accountCode:string,debit:number,credit:number,memo?:string}[],partyId?:string):ManualEntry=>({
  id,voucherNo,type,date,narration,entityId,locationId,currency:"INR",basis,
  partyId,lines,status:"posted" as const,createdAt:date+"T10:00:00.000Z",
});

const DEMO_JOURNAL_ENTRIES: ManualEntry[] = [
  // ── Monthly Payroll (6 JVs) ─────────────────────────────────────────────
  jv("jv-001","JV-0001","journal","2026-01-31","Payroll — January 2026","ent-1","loc-1","both",[{accountCode:"6010",debit:3500000,credit:0,memo:"Gross salaries Jan"},{accountCode:"1020",debit:0,credit:3500000,memo:"Bank disbursement"}]),
  jv("jv-002","JV-0002","journal","2026-02-28","Payroll — February 2026","ent-1","loc-1","both",[{accountCode:"6010",debit:3500000,credit:0},{accountCode:"1020",debit:0,credit:3500000}]),
  jv("jv-003","JV-0003","journal","2026-03-31","Payroll — March 2026","ent-1","loc-1","both",[{accountCode:"6010",debit:3650000,credit:0,memo:"Mar inc. variable pay"},{accountCode:"1020",debit:0,credit:3650000}]),
  jv("jv-004","JV-0004","journal","2026-04-30","Payroll — April 2026","ent-1","loc-1","both",[{accountCode:"6010",debit:3500000,credit:0},{accountCode:"1020",debit:0,credit:3500000}]),
  jv("jv-005","JV-0005","journal","2026-05-31","Payroll — May 2026","ent-1","loc-1","both",[{accountCode:"6010",debit:3500000,credit:0},{accountCode:"1020",debit:0,credit:3500000}]),
  jv("jv-006","JV-0006","journal","2026-06-28","Payroll — June 2026 (partial)","ent-1","loc-1","both",[{accountCode:"6010",debit:3500000,credit:0},{accountCode:"1020",debit:0,credit:3500000}]),
  // Payroll — ent-2 & ent-3 (quarterly combined)
  jv("jv-007","JV-0007","journal","2026-03-31","Payroll Q1 — Nexa Trading","ent-2","loc-2","both",[{accountCode:"6010",debit:2400000,credit:0,memo:"Q1 payroll ent-2"},{accountCode:"1020",debit:0,credit:2400000}]),
  jv("jv-008","JV-0008","journal","2026-06-30","Payroll Q2 — Nexa Trading","ent-2","loc-2","both",[{accountCode:"6010",debit:2550000,credit:0,memo:"Q2 payroll ent-2"},{accountCode:"1020",debit:0,credit:2550000}]),
  jv("jv-009","JV-0009","journal","2026-03-31","Payroll Q1 — Nexa Exports","ent-3","loc-3","both",[{accountCode:"6010",debit:1200000,credit:0,memo:"Q1 payroll ent-3"},{accountCode:"1020",debit:0,credit:1200000}]),
  jv("jv-010","JV-0010","journal","2026-06-30","Payroll Q2 — Nexa Exports","ent-3","loc-3","both",[{accountCode:"6010",debit:1300000,credit:0,memo:"Q2 payroll ent-3"},{accountCode:"1020",debit:0,credit:1300000}]),

  // ── Rent Purchases (booked quarterly) ──────────────────────────────────
  jv("jv-011","PUR-0001","purchase","2026-01-01","Office Lease Q1 — Bengaluru HQ","ent-1","loc-1","accrual",[{accountCode:"6020",debit:1500000,credit:0},{accountCode:"1300",debit:270000,credit:0},{accountCode:"2010",debit:0,credit:1770000}],"ven-18"),
  jv("jv-012","PAY-0001","payment","2026-01-10","Rent Payment Q1 — Bengaluru","ent-1","loc-1","both",[{accountCode:"2010",debit:1770000,credit:0},{accountCode:"1020",debit:0,credit:1770000}],"ven-18"),
  jv("jv-013","PUR-0002","purchase","2026-04-01","Office Lease Q2 — Bengaluru HQ","ent-1","loc-1","accrual",[{accountCode:"6020",debit:1500000,credit:0},{accountCode:"1300",debit:270000,credit:0},{accountCode:"2010",debit:0,credit:1770000}],"ven-18"),
  jv("jv-014","PUR-0003","purchase","2026-01-01","Office Lease Q1 — Mumbai DC","ent-2","loc-2","accrual",[{accountCode:"6020",debit:900000,credit:0},{accountCode:"1300",debit:162000,credit:0},{accountCode:"2010",debit:0,credit:1062000}],"ven-19"),
  jv("jv-015","PAY-0002","payment","2026-01-12","Rent Payment Q1 — Mumbai","ent-2","loc-2","both",[{accountCode:"2010",debit:1062000,credit:0},{accountCode:"1020",debit:0,credit:1062000}],"ven-19"),
  jv("jv-016","PUR-0004","purchase","2026-04-01","Office Lease Q2 — Mumbai DC","ent-2","loc-2","accrual",[{accountCode:"6020",debit:950000,credit:0},{accountCode:"1300",debit:171000,credit:0},{accountCode:"2010",debit:0,credit:1121000}],"ven-19"),

  // ── Sales vouchers (monthly representative entries) ──────────────────
  jv("jv-017","SAL-0001","sales","2026-01-20","FreshMart Jan — Atta & Masalas","ent-1","loc-1","accrual",[{accountCode:"1100",debit:11520000,credit:0},{accountCode:"4010",debit:0,credit:9000000},{accountCode:"2100",debit:0,credit:2520000}],"acc-01"),
  jv("jv-018","SAL-0002","sales","2026-01-25","Bigbasket Jan — Atta & Spices","ent-2","loc-2","accrual",[{accountCode:"1100",debit:9440000,credit:0},{accountCode:"4010",debit:0,credit:8000000},{accountCode:"2100",debit:0,credit:1440000}],"acc-21"),
  jv("jv-019","SAL-0003","sales","2026-01-28","Lulu Export Jan","ent-3","loc-3","accrual",[{accountCode:"1100",debit:8200000,credit:0},{accountCode:"4030",debit:0,credit:8200000}],"acc-24"),
  jv("jv-020","SAL-0004","sales","2026-02-17","FreshMart Feb","ent-1","loc-1","accrual",[{accountCode:"1100",debit:12380000,credit:0},{accountCode:"4010",debit:0,credit:10500000},{accountCode:"2100",debit:0,credit:1880000}],"acc-01"),
  jv("jv-021","SAL-0005","sales","2026-02-22","D-Mart Feb","ent-2","loc-2","accrual",[{accountCode:"1100",debit:14160000,credit:0},{accountCode:"4010",debit:0,credit:12000000},{accountCode:"2100",debit:0,credit:2160000}],"acc-14"),
  jv("jv-022","SAL-0006","sales","2026-02-25","Al Adil Export Feb","ent-3","loc-3","accrual",[{accountCode:"1100",debit:9600000,credit:0},{accountCode:"4030",debit:0,credit:9600000}],"acc-23"),
  jv("jv-023","SAL-0007","sales","2026-03-15","Metro Hyderabad Mar","ent-1","loc-1","accrual",[{accountCode:"1100",debit:15340000,credit:0},{accountCode:"4010",debit:0,credit:13000000},{accountCode:"2100",debit:0,credit:2340000}],"acc-04"),
  jv("jv-024","SAL-0008","sales","2026-03-22","Reliance Fresh Mar","ent-2","loc-2","accrual",[{accountCode:"1100",debit:17700000,credit:0},{accountCode:"4010",debit:0,credit:15000000},{accountCode:"2100",debit:0,credit:2700000}],"acc-16"),
  jv("jv-025","SAL-0009","sales","2026-03-28","NRI Bazaar Export Mar","ent-3","loc-3","accrual",[{accountCode:"1100",debit:11000000,credit:0},{accountCode:"4030",debit:0,credit:11000000}],"acc-25"),
  jv("jv-026","SAL-0010","sales","2026-04-10","BigBazaar Apr Atta & Oils","ent-1","loc-1","accrual",[{accountCode:"1100",debit:14160000,credit:0},{accountCode:"4010",debit:0,credit:12000000},{accountCode:"2100",debit:0,credit:2160000}],"acc-03"),
  jv("jv-027","SAL-0011","sales","2026-04-18","Bigbasket Apr","ent-2","loc-2","accrual",[{accountCode:"1100",debit:16520000,credit:0},{accountCode:"4010",debit:0,credit:14000000},{accountCode:"2100",debit:0,credit:2520000}],"acc-21"),
  jv("jv-028","SAL-0012","sales","2026-04-25","Lulu UAE Apr Export","ent-3","loc-3","accrual",[{accountCode:"1100",debit:13200000,credit:0},{accountCode:"4030",debit:0,credit:13200000}],"acc-24"),
  jv("jv-029","SAL-0013","sales","2026-05-12","FreshMart May","ent-1","loc-1","accrual",[{accountCode:"1100",debit:15930000,credit:0},{accountCode:"4010",debit:0,credit:13500000},{accountCode:"2100",debit:0,credit:2430000}],"acc-01"),
  jv("jv-030","SAL-0014","sales","2026-05-20","Swiggy Instamart May","ent-2","loc-2","accrual",[{accountCode:"1100",debit:18880000,credit:0},{accountCode:"4010",debit:0,credit:16000000},{accountCode:"2100",debit:0,credit:2880000}],"acc-17"),
  jv("jv-031","SAL-0015","sales","2026-05-28","Al Adil May Export","ent-3","loc-3","accrual",[{accountCode:"1100",debit:14600000,credit:0},{accountCode:"4030",debit:0,credit:14600000}],"acc-23"),
  jv("jv-032","SAL-0016","sales","2026-06-12","Metro Jun","ent-1","loc-1","accrual",[{accountCode:"1100",debit:14160000,credit:0},{accountCode:"4010",debit:0,credit:12000000},{accountCode:"2100",debit:0,credit:2160000}],"acc-04"),
  jv("jv-033","SAL-0017","sales","2026-06-20","D-Mart Jun","ent-2","loc-2","accrual",[{accountCode:"1100",debit:17700000,credit:0},{accountCode:"4010",debit:0,credit:15000000},{accountCode:"2100",debit:0,credit:2700000}],"acc-14"),
  jv("jv-034","SAL-0018","sales","2026-06-25","NRI Bazaar Jun Export","ent-3","loc-3","accrual",[{accountCode:"1100",debit:12000000,credit:0},{accountCode:"4030",debit:0,credit:12000000}],"acc-25"),

  // ── Purchase vouchers (RM, PM, Logistics monthly) ────────────────────
  jv("jv-035","PUR-0005","purchase","2026-01-08","Sterling Grains — Wheat & Rice Jan","ent-1","loc-1","accrual",[{accountCode:"5010",debit:214500,credit:0},{accountCode:"1300",debit:38610,credit:0},{accountCode:"2010",debit:0,credit:253110}],"ven-01"),
  jv("jv-036","PUR-0006","purchase","2026-01-10","BlueOcean Packaging — Jan","ent-1","loc-8","accrual",[{accountCode:"5010",debit:93400,credit:0},{accountCode:"1300",debit:16812,credit:0},{accountCode:"2010",debit:0,credit:110212}],"ven-07"),
  jv("jv-037","PUR-0007","purchase","2026-01-31","Swift Logistics — Jan Freight","ent-1","loc-1","accrual",[{accountCode:"5020",debit:350000,credit:0},{accountCode:"1300",debit:63000,credit:0},{accountCode:"2010",debit:0,credit:413000}],"ven-11"),
  jv("jv-038","PUR-0008","purchase","2026-02-05","Sterling Grains — Feb","ent-1","loc-1","accrual",[{accountCode:"5010",debit:244000,credit:0},{accountCode:"1300",debit:43920,credit:0},{accountCode:"2010",debit:0,credit:287920}],"ven-01"),
  jv("jv-039","PUR-0009","purchase","2026-02-28","Logistics Feb","ent-1","loc-1","accrual",[{accountCode:"5020",debit:360000,credit:0},{accountCode:"1300",debit:64800,credit:0},{accountCode:"2010",debit:0,credit:424800}],"ven-11"),
  jv("jv-040","PUR-0010","purchase","2026-03-04","Pioneer Seeds — Mar","ent-1","loc-1","accrual",[{accountCode:"5010",debit:228000,credit:0},{accountCode:"1300",debit:41040,credit:0},{accountCode:"2010",debit:0,credit:269040}],"ven-02"),
  jv("jv-041","PUR-0011","purchase","2026-03-31","Logistics Mar","ent-1","loc-1","accrual",[{accountCode:"5020",debit:420000,credit:0},{accountCode:"1300",debit:75600,credit:0},{accountCode:"2010",debit:0,credit:495600}],"ven-11"),
  jv("jv-042","PUR-0012","purchase","2026-04-05","Sterling Grains — Apr","ent-1","loc-1","accrual",[{accountCode:"5010",debit:316000,credit:0},{accountCode:"1300",debit:56880,credit:0},{accountCode:"2010",debit:0,credit:372880}],"ven-01"),
  jv("jv-043","PUR-0013","purchase","2026-04-30","Logistics Apr","ent-1","loc-1","accrual",[{accountCode:"5020",debit:450000,credit:0},{accountCode:"1300",debit:81000,credit:0},{accountCode:"2010",debit:0,credit:531000}],"ven-11"),
  jv("jv-044","PUR-0014","purchase","2026-05-06","Pioneer Seeds — May","ent-1","loc-1","accrual",[{accountCode:"5010",debit:373500,credit:0},{accountCode:"1300",debit:67230,credit:0},{accountCode:"2010",debit:0,credit:440730}],"ven-02"),
  jv("jv-045","PUR-0015","purchase","2026-05-31","Logistics May","ent-1","loc-1","accrual",[{accountCode:"5020",debit:450000,credit:0},{accountCode:"1300",debit:81000,credit:0},{accountCode:"2010",debit:0,credit:531000}],"ven-11"),
  jv("jv-046","PUR-0016","purchase","2026-06-04","Sterling Grains — Jun","ent-1","loc-1","accrual",[{accountCode:"5010",debit:291500,credit:0},{accountCode:"1300",debit:52470,credit:0},{accountCode:"2010",debit:0,credit:343970}],"ven-01"),
  jv("jv-047","PUR-0017","purchase","2026-06-30","Logistics Jun","ent-1","loc-1","accrual",[{accountCode:"5020",debit:480000,credit:0},{accountCode:"1300",debit:86400,credit:0},{accountCode:"2010",debit:0,credit:566400}],"ven-11"),

  // ── Receipts from customers ──────────────────────────────────────────
  jv("jv-048","REC-0001","receipt","2026-01-30","FreshMart Jan payment","ent-1","loc-1","both",[{accountCode:"1020",debit:11520000,credit:0},{accountCode:"1100",debit:0,credit:11520000}],"acc-01"),
  jv("jv-049","REC-0002","receipt","2026-02-15","Bigbasket Jan payment","ent-2","loc-2","both",[{accountCode:"1020",debit:9440000,credit:0},{accountCode:"1100",debit:0,credit:9440000}],"acc-21"),
  jv("jv-050","REC-0003","receipt","2026-03-10","FreshMart Feb payment","ent-1","loc-1","both",[{accountCode:"1020",debit:12380000,credit:0},{accountCode:"1100",debit:0,credit:12380000}],"acc-01"),
  jv("jv-051","REC-0004","receipt","2026-03-18","D-Mart Feb payment","ent-2","loc-2","both",[{accountCode:"1020",debit:14160000,credit:0},{accountCode:"1100",debit:0,credit:14160000}],"acc-14"),
  jv("jv-052","REC-0005","receipt","2026-04-10","Metro Mar payment","ent-1","loc-1","both",[{accountCode:"1020",debit:15340000,credit:0},{accountCode:"1100",debit:0,credit:15340000}],"acc-04"),
  jv("jv-053","REC-0006","receipt","2026-04-22","Reliance Fresh Mar payment","ent-2","loc-2","both",[{accountCode:"1020",debit:17700000,credit:0},{accountCode:"1100",debit:0,credit:17700000}],"acc-16"),
  jv("jv-054","REC-0007","receipt","2026-05-08","BigBazaar Apr payment","ent-1","loc-1","both",[{accountCode:"1020",debit:14160000,credit:0},{accountCode:"1100",debit:0,credit:14160000}],"acc-03"),
  jv("jv-055","REC-0008","receipt","2026-05-25","Bigbasket Apr payment","ent-2","loc-2","both",[{accountCode:"1020",debit:16520000,credit:0},{accountCode:"1100",debit:0,credit:16520000}],"acc-21"),
  jv("jv-056","REC-0009","receipt","2026-06-10","FreshMart May payment","ent-1","loc-1","both",[{accountCode:"1020",debit:15930000,credit:0},{accountCode:"1100",debit:0,credit:15930000}],"acc-01"),
  jv("jv-057","REC-0010","receipt","2026-06-20","Swiggy Instamart May payment","ent-2","loc-2","both",[{accountCode:"1020",debit:18880000,credit:0},{accountCode:"1100",debit:0,credit:18880000}],"acc-17"),

  // ── Depreciation (6 monthly) ─────────────────────────────────────────
  jv("jv-058","JV-0011","journal","2026-01-31","Depreciation — January 2026","ent-1","loc-1","accrual",[{accountCode:"6080",debit:350000,credit:0},{accountCode:"1590",debit:0,credit:350000}]),
  jv("jv-059","JV-0012","journal","2026-02-28","Depreciation — February 2026","ent-1","loc-1","accrual",[{accountCode:"6080",debit:350000,credit:0},{accountCode:"1590",debit:0,credit:350000}]),
  jv("jv-060","JV-0013","journal","2026-03-31","Depreciation — March 2026","ent-1","loc-1","accrual",[{accountCode:"6080",debit:480000,credit:0,memo:"Post packing machine commissioning"},{accountCode:"1590",debit:0,credit:480000}]),
  jv("jv-061","JV-0014","journal","2026-04-30","Depreciation — April 2026","ent-1","loc-1","accrual",[{accountCode:"6080",debit:580000,credit:0,memo:"Post mill upgrade"},{accountCode:"1590",debit:0,credit:580000}]),
  jv("jv-062","JV-0015","journal","2026-05-31","Depreciation — May 2026","ent-1","loc-1","accrual",[{accountCode:"6080",debit:580000,credit:0},{accountCode:"1590",debit:0,credit:580000}]),
  jv("jv-063","JV-0016","journal","2026-06-28","Depreciation — June 2026","ent-1","loc-1","accrual",[{accountCode:"6080",debit:580000,credit:0},{accountCode:"1590",debit:0,credit:580000}]),

  // ── Capex / Asset purchases ──────────────────────────────────────────
  jv("jv-064","AST-0001","asset","2026-01-20","Robotic Packing Machine — Pune","ent-1","loc-4","accrual",[{accountCode:"1500",debit:3500000,credit:0},{accountCode:"1300",debit:630000,credit:0},{accountCode:"2010",debit:0,credit:4130000}],"ven-21"),
  jv("jv-065","PAY-0003","payment","2026-02-28","Robopack — Asset Payment","ent-1","loc-4","both",[{accountCode:"2010",debit:4130000,credit:0},{accountCode:"1020",debit:0,credit:4130000}],"ven-21"),
  jv("jv-066","AST-0002","asset","2026-03-01","Flour Mill Rollers Upgrade","ent-1","loc-1","accrual",[{accountCode:"1500",debit:2400000,credit:0},{accountCode:"1300",debit:432000,credit:0},{accountCode:"2010",debit:0,credit:2832000}],"ven-22"),
  jv("jv-067","PAY-0004","payment","2026-03-25","Maize Engineering — Asset Payment","ent-1","loc-1","both",[{accountCode:"2010",debit:2832000,credit:0},{accountCode:"1020",debit:0,credit:2832000}],"ven-22"),
  jv("jv-068","AST-0003","asset","2026-01-20","Office Furniture — Delhi Hub","ent-3","loc-3","accrual",[{accountCode:"1510",debit:900000,credit:0},{accountCode:"1300",debit:162000,credit:0},{accountCode:"2010",debit:0,credit:1062000}],"ven-23"),
  jv("jv-069","PAY-0005","payment","2026-02-15","Officespace Furnishers Payment","ent-3","loc-3","both",[{accountCode:"2010",debit:1062000,credit:0},{accountCode:"1020",debit:0,credit:1062000}],"ven-23"),

  // ── IT & Software ───────────────────────────────────────────────────
  jv("jv-070","PUR-0018","purchase","2026-01-05","ERP License Q1 2026","ent-1","loc-1","accrual",[{accountCode:"6060",debit:255000,credit:0},{accountCode:"1300",debit:45900,credit:0},{accountCode:"2010",debit:0,credit:300900}],"ven-14"),
  jv("jv-071","PAY-0006","payment","2026-01-15","TechSoft Q1 Payment","ent-1","loc-1","both",[{accountCode:"2010",debit:300900,credit:0},{accountCode:"1020",debit:0,credit:300900}],"ven-14"),
  jv("jv-072","PUR-0019","purchase","2026-04-05","ERP License Q2 2026","ent-1","loc-1","accrual",[{accountCode:"6060",debit:255000,credit:0},{accountCode:"1300",debit:45900,credit:0},{accountCode:"2010",debit:0,credit:300900}],"ven-14"),

  // ── Utilities (monthly bank payments) ────────────────────────────────
  jv("jv-073","BNK-0001","bank","2026-01-31","Electricity — Bengaluru Plant Jan","ent-1","loc-1","both",[{accountCode:"6030",debit:280000,credit:0},{accountCode:"1020",debit:0,credit:280000}]),
  jv("jv-074","BNK-0002","bank","2026-02-28","Electricity & Water — Feb","ent-1","loc-1","both",[{accountCode:"6030",debit:295000,credit:0},{accountCode:"1020",debit:0,credit:295000}]),
  jv("jv-075","BNK-0003","bank","2026-03-31","Electricity — Mar","ent-1","loc-1","both",[{accountCode:"6030",debit:310000,credit:0},{accountCode:"1020",debit:0,credit:310000}]),
  jv("jv-076","BNK-0004","bank","2026-04-30","Electricity — Apr","ent-1","loc-1","both",[{accountCode:"6030",debit:325000,credit:0},{accountCode:"1020",debit:0,credit:325000}]),
  jv("jv-077","BNK-0005","bank","2026-05-31","Electricity & Water — May","ent-1","loc-1","both",[{accountCode:"6030",debit:340000,credit:0},{accountCode:"1020",debit:0,credit:340000}]),
  jv("jv-078","BNK-0006","bank","2026-06-28","Electricity — Jun","ent-1","loc-1","both",[{accountCode:"6030",debit:330000,credit:0},{accountCode:"1020",debit:0,credit:330000}]),

  // ── Marketing spend ──────────────────────────────────────────────────
  jv("jv-079","PUR-0020","purchase","2026-04-01","Brand Campaign — Summer 2026","ent-1","loc-1","accrual",[{accountCode:"6040",debit:800000,credit:0},{accountCode:"1300",debit:144000,credit:0},{accountCode:"2010",debit:0,credit:944000}],"ven-16"),
  jv("jv-080","PAY-0007","payment","2026-04-20","BrandWave Campaign Payment","ent-1","loc-1","both",[{accountCode:"2010",debit:944000,credit:0},{accountCode:"1020",debit:0,credit:944000}],"ven-16"),

  // ── GST / TDS adjustments ────────────────────────────────────────────
  jv("jv-081","JV-0017","journal","2026-03-31","GST Net-off Q1 — ITC vs Output","ent-1","loc-1","accrual",[{accountCode:"2100",debit:6300000,credit:0,memo:"Output GST cleared"},{accountCode:"1300",debit:0,credit:4200000,memo:"ITC utilized"},{accountCode:"1020",debit:0,credit:2100000,memo:"Net GST cash payment"}]),
  jv("jv-082","JV-0018","journal","2026-06-30","GST Net-off Q2 — ITC vs Output","ent-1","loc-1","accrual",[{accountCode:"2100",debit:7200000,credit:0},{accountCode:"1300",debit:0,credit:4800000},{accountCode:"1020",debit:0,credit:2400000}]),

  // ── Equity / Capital infusion ────────────────────────────────────────
  jv("jv-083","JV-0019","journal","2026-01-05","Capital infusion — Promoters","ent-3","loc-3","both",[{accountCode:"1020",debit:5000000,credit:0,memo:"Promoter capital Jan 2026"},{accountCode:"3010",debit:0,credit:5000000}]),

  // ── Intercompany ─────────────────────────────────────────────────────
  jv("jv-084","JV-0020","journal","2026-03-31","IC Receivable — Nexa Foods → Trading Q1","ent-1","loc-1","accrual",[{accountCode:"1320",debit:5000000,credit:0,memo:"Intercompany sale of FG to ent-2"},{accountCode:"4010",debit:0,credit:5000000}]),
  jv("jv-085","JV-0021","journal","2026-03-31","IC Payable — Nexa Trading from Foods Q1","ent-2","loc-2","accrual",[{accountCode:"5010",debit:5000000,credit:0,memo:"Intercompany purchase from ent-1"},{accountCode:"2020",debit:0,credit:5000000}]),

  // ── Vendor payments (AP clearing) ───────────────────────────────────
  jv("jv-086","PAY-0008","payment","2026-02-25","Sterling Grains Jan+Feb Payment","ent-1","loc-1","both",[{accountCode:"2010",debit:541030,credit:0},{accountCode:"1020",debit:0,credit:541030}],"ven-01"),
  jv("jv-087","PAY-0009","payment","2026-03-28","Sunrise Spices Jan Payment","ent-1","loc-1","both",[{accountCode:"2010",debit:128148,credit:0},{accountCode:"1020",debit:0,credit:128148}],"ven-05"),
  jv("jv-088","PAY-0010","payment","2026-04-28","Nature's Best Organics Mar Payment","ent-1","loc-1","both",[{accountCode:"2010",debit:225675,credit:0},{accountCode:"1020",debit:0,credit:225675}],"ven-04"),
  jv("jv-089","PAY-0011","payment","2026-05-30","Pioneer Seeds Mar Payment","ent-1","loc-1","both",[{accountCode:"2010",debit:269040,credit:0},{accountCode:"1020",debit:0,credit:269040}],"ven-02"),
  jv("jv-090","PAY-0012","payment","2026-06-25","BlueOcean Packaging May Payment","ent-1","loc-8","both",[{accountCode:"2010",debit:156350,credit:0},{accountCode:"1020",debit:0,credit:156350}],"ven-07"),
];

// ── FIXED ASSETS (10) ─────────────────────────────────────────────────────────
const DEMO_ASSETS: FixedAsset[] = [
  {id:"ast-001",tag:"FA-0001",name:"Robotic Packing Machine RP-500",category:"Plant & Machinery",entityId:"ent-1",locationId:"loc-4",acquisitionDate:"2026-01-20",cost:3500000,salvage:350000,usefulLifeYears:10,method:"WDV",annualBenefit:1200000,supplier:"Robopack Industries"},
  {id:"ast-002",tag:"FA-0002",name:"High-Capacity Flour Mill Roller Set",category:"Plant & Machinery",entityId:"ent-1",locationId:"loc-1",acquisitionDate:"2026-03-01",cost:2400000,salvage:240000,usefulLifeYears:15,method:"WDV",annualBenefit:900000,supplier:"Maize Engineering Works"},
  {id:"ast-003",tag:"FA-0003",name:"Office Workstations & Chairs — Delhi (20 sets)",category:"Furniture & Fixtures",entityId:"ent-3",locationId:"loc-3",acquisitionDate:"2026-01-20",cost:900000,salvage:90000,usefulLifeYears:8,method:"SLM",annualBenefit:200000,supplier:"Officespace Furnishers"},
  {id:"ast-004",tag:"FA-0004",name:"Canon imagePROGRAF & DR Scanners (8 units)",category:"Computers & IT",entityId:"ent-1",locationId:"loc-1",acquisitionDate:"2026-01-25",cost:430000,salvage:43000,usefulLifeYears:3,method:"WDV",annualBenefit:150000,supplier:"Canon India Ltd"},
  {id:"ast-005",tag:"FA-0005",name:"Factory Forklift — Bengaluru Plant",category:"Vehicles",entityId:"ent-1",locationId:"loc-1",acquisitionDate:"2025-07-01",cost:1800000,salvage:300000,usefulLifeYears:8,method:"WDV",annualBenefit:600000,supplier:"Godrej Material Handling"},
  {id:"ast-006",tag:"FA-0006",name:"Delivery Van — Mumbai DC",category:"Vehicles",entityId:"ent-2",locationId:"loc-2",acquisitionDate:"2025-09-01",cost:1200000,salvage:200000,usefulLifeYears:8,method:"WDV",annualBenefit:400000,supplier:"Tata Motors Ltd"},
  {id:"ast-007",tag:"FA-0007",name:"Chiller Room — Bengaluru Plant",category:"Plant & Machinery",entityId:"ent-1",locationId:"loc-1",acquisitionDate:"2024-10-01",cost:2200000,salvage:220000,usefulLifeYears:12,method:"WDV",annualBenefit:500000,supplier:"Blue Star Ltd"},
  {id:"ast-008",tag:"FA-0008",name:"ERP Implementation (Capitalised)",category:"Computers & IT",entityId:"ent-1",locationId:"loc-1",acquisitionDate:"2024-04-01",cost:1500000,salvage:0,usefulLifeYears:5,method:"SLM",annualBenefit:800000,supplier:"TechSoft Solutions"},
  {id:"ast-009",tag:"FA-0009",name:"Lab Equipment — QA Testing",category:"Plant & Machinery",entityId:"ent-1",locationId:"loc-1",acquisitionDate:"2024-06-15",cost:850000,salvage:85000,usefulLifeYears:10,method:"SLM",annualBenefit:300000,supplier:"Sartorius India Pvt Ltd"},
  {id:"ast-010",tag:"FA-0010",name:"Office Server & Network Infrastructure",category:"Computers & IT",entityId:"ent-1",locationId:"loc-1",acquisitionDate:"2024-08-01",cost:650000,salvage:65000,usefulLifeYears:5,method:"WDV",annualBenefit:250000,supplier:"Dell India Pvt Ltd"},
];

// ── EMPLOYEE LOANS (5) ────────────────────────────────────────────────────────
const DEMO_LOANS: Loan[] = [
  {id:"loan-001",empId:"emp-022",type:"personal",principal:300000,annualRatePct:8,tenureMonths:24,startMonth:"2026-01-01",status:"active",purpose:"Home renovation loan"},
  {id:"loan-002",empId:"emp-057",type:"salary-advance",principal:50000,annualRatePct:0,tenureMonths:5,startMonth:"2026-02-01",status:"active",purpose:"Medical emergency advance"},
  {id:"loan-003",empId:"emp-035",type:"festival",principal:80000,annualRatePct:5,tenureMonths:10,startMonth:"2026-01-01",status:"active",purpose:"Diwali festival loan"},
  {id:"loan-004",empId:"emp-010",type:"personal",principal:500000,annualRatePct:10,tenureMonths:36,startMonth:"2025-10-01",status:"active",purpose:"Vehicle purchase"},
  {id:"loan-005",empId:"emp-068",type:"emergency",principal:100000,annualRatePct:6,tenureMonths:12,startMonth:"2026-03-01",status:"active",purpose:"Emergency medical expenses"},
];

// ── CRM JOURNEY EVENTS (80) ───────────────────────────────────────────────────
const DEMO_CRM_EVENTS: JourneyEvent[] = [
  // Won accounts — activity history
  {id:"evt-001",accountId:"acc-01",date:"2026-01-10",type:"meeting",title:"Quarterly Business Review",detail:"Reviewed Q4 performance. FreshMart happy with delivery TAT. Discussed expanding SKU range to include oils and pickles.",tags:["decision-maker"],authorId:"emp-016",seed:true},
  {id:"evt-002",accountId:"acc-01",date:"2026-01-18",type:"invoice",title:"INV SAL-0001 sent",detail:"Invoice for Jan supply dispatched. Net 30 terms.",tags:[],authorId:"emp-007",seed:true},
  {id:"evt-003",accountId:"acc-01",date:"2026-02-05",type:"note",title:"Positive feedback on Wheat Atta quality",detail:"Purchase manager Rajesh Verma called to appreciate consistent quality. Mentioned competitor quotes are 3% higher.",tags:["champion"],authorId:"emp-016",seed:true},
  {id:"evt-004",accountId:"acc-01",date:"2026-03-15",type:"deal",title:"Annual contract renewed — ₹3.6 Cr",detail:"Annual contract for FY2026-27 signed. Value ₹3.6 Cr. Terms: 30 days credit, 2% prompt-pay discount.",tags:["decision-maker","upsell"],authorId:"emp-016",seed:true},
  {id:"evt-005",accountId:"acc-04",date:"2026-01-05",type:"meeting",title:"Hyderabad DC review with Metro",detail:"Metro procurement head visited Bengaluru plant. Impressed with facility and QC processes.",tags:["decision-maker"],authorId:"emp-016",seed:true},
  {id:"evt-006",accountId:"acc-04",date:"2026-01-22",type:"invoice",title:"Metro Jan INV dispatched",detail:"Monthly supply invoice for Jan spices and pickles.",tags:[],authorId:"emp-007",seed:true},
  {id:"evt-007",accountId:"acc-04",date:"2026-03-10",type:"note",title:"Proposed Coconut Oil range",detail:"Shared samples of new Coconut Oil 500ml. Metro interested in 500-unit trial.",tags:["upsell"],authorId:"emp-021",seed:true},
  {id:"evt-008",accountId:"acc-14",date:"2026-01-12",type:"meeting",title:"D-Mart Vendor Meet — Mumbai",detail:"Annual vendor conference. Nexa Foods recognized as Top 10 FMCG Supplier of 2025.",tags:["champion","decision-maker"],authorId:"emp-018",seed:true},
  {id:"evt-009",accountId:"acc-14",date:"2026-02-01",type:"note",title:"D-Mart listing expanded to 3 new stores",detail:"Approved for Ahmedabad, Surat, and Vadodara D-Mart stores. Volumes to increase by ~15%.",tags:["upsell"],authorId:"emp-018",seed:true},
  {id:"evt-010",accountId:"acc-14",date:"2026-04-08",type:"invoice",title:"D-Mart Apr INV",detail:"April supply — Wheat Atta 5kg and Basmati Rice 5kg bulk order.",tags:[],authorId:"emp-007",seed:true},
  {id:"evt-011",accountId:"acc-21",date:"2026-01-08",type:"call",title:"Bigbasket category team call",detail:"Discussed increasing Nexa SKU count on BB platform. Proposal to list 8 new spice mixes.",tags:["decision-maker","hot"],authorId:"emp-021",seed:true},
  {id:"evt-012",accountId:"acc-21",date:"2026-02-12",type:"meeting",title:"Bigbasket New SKU onboarding",detail:"Completed onboarding for 6 new SKUs — Biryani Masala, Chole Masala, Rasam Powder, Cake Mix, Gulab Jamun Mix, Khichdi Mix.",tags:["upsell"],authorId:"emp-018",seed:true},
  {id:"evt-013",accountId:"acc-21",date:"2026-03-25",type:"deal",title:"Annual BBDL listing renewed — ₹11.2 Cr",detail:"Long-term listing agreement renewed with 5% YoY volume growth clause.",tags:["decision-maker"],authorId:"emp-016",seed:true},
  {id:"evt-014",accountId:"acc-24",date:"2026-01-15",type:"meeting",title:"Lulu Abu Dhabi — New Season Order",detail:"Video call with Lulu group buyer. Discussed summer festival packaging for GCC market.",tags:["hot","decision-maker"],authorId:"emp-020",seed:true},
  {id:"evt-015",accountId:"acc-24",date:"2026-02-10",type:"deal",title:"Lulu Q1 Export Order Confirmed",detail:"Order confirmed for 4,000 units Wheat Atta 1kg + 1,500 Kitchen King + 2,000 Garam Masala. Value AED 285,000.",tags:["decision-maker"],authorId:"emp-020",seed:true},
  {id:"evt-016",accountId:"acc-23",date:"2026-01-20",type:"call",title:"Al Adil reorder call",detail:"Al Adil called to confirm Feb replenishment. Requested addition of Coconut Oil to shipment.",tags:["renewal"],authorId:"emp-020",seed:true},
  {id:"evt-017",accountId:"acc-23",date:"2026-03-18",type:"invoice",title:"Al Adil Mar Export INV",detail:"Export invoice dispatched for March shipment. IGST zero-rated.",tags:[],authorId:"emp-007",seed:true},
  // Negotiation accounts — active pursuit
  {id:"evt-018",accountId:"acc-29",date:"2026-02-10",type:"meeting",title:"More Retail national buyer meeting",detail:"Presented full SKU portfolio to More national category buyer. Positive reception for atta and spice ranges.",tags:["hot","decision-maker"],authorId:"emp-017",seed:true},
  {id:"evt-019",accountId:"acc-29",date:"2026-03-05",type:"email",title:"Proposal sent — ₹3.6 Cr annual",detail:"Formal proposal sent covering 12 SKUs across atta, rice, spices, and oils. Pricing aligned to D-Mart terms.",tags:["pricing"],authorId:"emp-017",seed:true},
  {id:"evt-020",accountId:"acc-29",date:"2026-04-01",type:"call",title:"Counter-proposal received",detail:"More buyer requested 4% additional trade discount. Escalated to VP Sales for approval.",tags:["pricing","blocker"],authorId:"emp-021",seed:true},
  {id:"evt-021",accountId:"acc-29",date:"2026-04-20",type:"meeting",title:"Negotiation meeting — final terms",detail:"Agreed on 2.5% trade discount with quarterly rebate. Awaiting legal sign-off on contract.",tags:["decision-maker"],authorId:"emp-016",seed:true},
  {id:"evt-022",accountId:"acc-32",date:"2026-02-20",type:"meeting",title:"Akshaya Patra — nutrition partnership discussion",detail:"Met with Akshaya Patra procurement team. Discussed supply of fortified atta and multigrain mixes for mid-day meal program.",tags:["hot","decision-maker"],authorId:"emp-017",seed:true},
  {id:"evt-023",accountId:"acc-32",date:"2026-03-15",type:"email",title:"Compliance documents submitted",detail:"Submitted FSSAI, AGMARK, and fortification certificates as required by Akshaya Patra.",tags:[],authorId:"emp-017",seed:true},
  {id:"evt-024",accountId:"acc-32",date:"2026-04-10",type:"call",title:"Tender evaluation in progress",detail:"AP procurement team confirmed we are shortlisted for the tender evaluation. Decision expected in 4 weeks.",tags:["follow-up"],authorId:"emp-017",seed:true},
  {id:"evt-025",accountId:"acc-33",date:"2026-03-10",type:"meeting",title:"ITC Hotels F&B procurement meet",detail:"Presented specialty spice mixes and cooking sauces to ITC F&B director. High interest in premium range.",tags:["decision-maker","hot"],authorId:"emp-033",seed:true},
  {id:"evt-026",accountId:"acc-33",date:"2026-04-05",type:"email",title:"Sample approval received — 4 products",detail:"ITC approved Kitchen King, Garam Masala, Biryani Masala, and Coconut Oil for hotel kitchens.",tags:["champion"],authorId:"emp-033",seed:true},
  {id:"evt-027",accountId:"acc-37",date:"2026-02-15",type:"meeting",title:"Amazon Pantry vendor onboarding",detail:"Completed vendor registration with Amazon Pantry team. 6 SKUs approved for listing.",tags:["decision-maker"],authorId:"emp-024",seed:true},
  {id:"evt-028",accountId:"acc-37",date:"2026-03-20",type:"email",title:"First PO from Amazon Pantry",detail:"Amazon placed first trial PO worth ₹45,000 across 3 SKUs.",tags:["hot"],authorId:"emp-024",seed:true},
  {id:"evt-029",accountId:"acc-37",date:"2026-04-15",type:"note",title:"Trial PO sold out — positive review",detail:"All 3 SKUs sold out within 12 days. Amazon Pantry buyer mentioned 4.4-star average rating.",tags:["upsell","champion"],authorId:"emp-018",seed:true},
  {id:"evt-030",accountId:"acc-40",date:"2026-01-25",type:"email",title:"Flipkart Grocery — expression of interest",detail:"Flipkart grocery team reached out for product listing. Shared catalogue and pricing sheet.",tags:["intro"],authorId:"emp-023",seed:true},
  {id:"evt-031",accountId:"acc-40",date:"2026-02-28",type:"meeting",title:"Flipkart HQ meeting — Bengaluru",detail:"Met category manager. 10 SKUs approved for listing. Platform fees at 12%.",tags:["pricing","decision-maker"],authorId:"emp-018",seed:true},
  {id:"evt-032",accountId:"acc-40",date:"2026-04-10",type:"deal",title:"Flipkart listing contract signed",detail:"Annual listing contract worth ₹5.4 Cr. 60-day exclusivity on Multigrain Atta 1kg.",tags:["decision-maker"],authorId:"emp-016",seed:true},
  // Proposal accounts
  {id:"evt-033",accountId:"acc-44",date:"2026-03-15",type:"call",title:"Green Basket — initial contact",detail:"Spoke with procurement head. Interest in rice flour and dosa mix range for Tamil Nadu market.",tags:["intro"],authorId:"emp-019",seed:true},
  {id:"evt-034",accountId:"acc-44",date:"2026-04-02",type:"email",title:"Proposal sent — South India range",detail:"Sent proposal for 6 South Indian specialty SKUs — Rice Flour, Idli Mix, Dosa Mix, Sambhar Powder, Rasam Powder, Mini Idly Rice.",tags:["follow-up"],authorId:"emp-019",seed:true},
  {id:"evt-035",accountId:"acc-44",date:"2026-05-10",type:"call",title:"Follow-up — awaiting mgmt approval",detail:"Buyer mentioned proposal is with management for approval. Expected decision in 2 weeks.",tags:["follow-up"],authorId:"emp-019",seed:true},
  {id:"evt-036",accountId:"acc-48",date:"2026-04-01",type:"meeting",title:"Hyperpure (Zomato) onboarding call",detail:"Hyperpure supplies restaurant kitchens across India. Interested in bulk spice packs and cooking oils.",tags:["hot","decision-maker"],authorId:"emp-021",seed:true},
  {id:"evt-037",accountId:"acc-48",date:"2026-04-22",type:"email",title:"Samples dispatched to Hyperpure",detail:"Sent 10 product samples — spice mixes, cooking sauces, and oil range.",tags:[],authorId:"emp-021",seed:true},
  {id:"evt-038",accountId:"acc-48",date:"2026-05-20",type:"note",title:"Sample feedback — 8 of 10 approved",detail:"Kitchen teams approved 8 products. Tomato Ketchup and Soy Sauce need minor packaging update for HoReCa format.",tags:["follow-up"],authorId:"emp-021",seed:true},
  {id:"evt-039",accountId:"acc-56",date:"2026-03-10",type:"call",title:"Masala King Qatar — first contact",detail:"Was referred by Lulu UAE. Masala King is a GCC specialty Indian food chain. Interest in branded spice range.",tags:["intro","hot"],authorId:"emp-020",seed:true},
  {id:"evt-040",accountId:"acc-56",date:"2026-04-05",type:"email",title:"Qatar export compliance docs sent",detail:"Sent halal certificate, FSSAI, and product spec sheets as required by Masala King for Qatar import clearance.",tags:[],authorId:"emp-020",seed:true},
  {id:"evt-041",accountId:"acc-56",date:"2026-05-15",type:"meeting",title:"Video call with Qatar MD",detail:"MD of Masala King expressed strong interest. Proposal for 8 SKUs worth ₹2.4 Cr annual.",tags:["decision-maker"],authorId:"emp-016",seed:true},
  // Qualified leads
  {id:"evt-042",accountId:"acc-59",date:"2026-03-01",type:"call",title:"Prasuma Meals — lead qualification",detail:"Spoke to their food procurement team. Looking for ready-mix ingredients for their cloud kitchen operations.",tags:["intro"],authorId:"emp-022",seed:true},
  {id:"evt-043",accountId:"acc-59",date:"2026-04-10",type:"meeting",title:"Plant visit",detail:"Prasuma team visited Bengaluru plant. Impressed with food safety standards and certifications.",tags:["champion"],authorId:"emp-022",seed:true},
  {id:"evt-044",accountId:"acc-62",date:"2026-03-15",type:"call",title:"Arogya Health Foods — initial contact",detail:"Arogya makes health supplements. Interested in quinoa, amaranth, and makhana as ingredients.",tags:["intro"],authorId:"emp-022",seed:true},
  {id:"evt-045",accountId:"acc-62",date:"2026-05-01",type:"email",title:"Technical spec sheet requested",detail:"Arogya nutritionist requested lab reports and amino acid profile for quinoa and amaranth.",tags:["follow-up"],authorId:"emp-022",seed:true},
  {id:"evt-046",accountId:"acc-66",date:"2026-04-05",type:"meeting",title:"Saravana Bhavan — bulk supply discussion",detail:"Popular restaurant chain exploring supplier change. Interested in consistent quality sambhar powder and rasam powder.",tags:["hot","decision-maker"],authorId:"emp-019",seed:true},
  {id:"evt-047",accountId:"acc-66",date:"2026-05-10",type:"note",title:"Trial order placed",detail:"Small trial order of 200kg Sambhar Powder and 100kg Rasam Powder for 3 outlets.",tags:["champion"],authorId:"emp-019",seed:true},
  {id:"evt-048",accountId:"acc-68",date:"2026-03-20",type:"email",title:"Curry Leaf USA — export inquiry",detail:"US-based Indian grocery chain. Interested in atta, masalas, and pickles for diaspora market.",tags:["intro"],authorId:"emp-020",seed:true},
  {id:"evt-049",accountId:"acc-68",date:"2026-04-28",type:"call",title:"Compliance discussion — US FDA",detail:"Discussed US FDA import requirements, nutritional labelling format, and country-of-origin marking.",tags:["follow-up"],authorId:"emp-020",seed:true},
  // New leads
  {id:"evt-050",accountId:"acc-70",date:"2026-05-15",type:"call",title:"Fresh Amma — first contact",detail:"Small Bengaluru retail chain with 8 stores. Interested in Nexa pickle range.",tags:["intro"],authorId:"emp-021",seed:true},
  {id:"evt-051",accountId:"acc-71",date:"2026-05-20",type:"email",title:"AshiCorp Meals — intro email",detail:"Corporate cafeteria caterer. Sent intro email and product catalogue.",tags:["intro"],authorId:"emp-022",seed:true},
  {id:"evt-052",accountId:"acc-72",date:"2026-06-01",type:"call",title:"Healthy Bites — qualification call",detail:"Health-focused restaurant chain. Interested in multigrain range and quinoa.",tags:["intro","hot"],authorId:"emp-022",seed:true},
  {id:"evt-053",accountId:"acc-74",date:"2026-06-10",type:"email",title:"Spice Emporium Bahrain — export inquiry",detail:"GCC spice retailer. Reached out after seeing Al Adil showcase our products.",tags:["intro"],authorId:"emp-020",seed:true},
  // Additional events for won accounts (ongoing)
  {id:"evt-054",accountId:"acc-02",date:"2026-01-15",type:"meeting",title:"Nature's Basket Q1 planning",detail:"Reviewed Q1 shelf allocation. Nature's Basket expanding premium section — Nexa to get 3 more facings.",tags:["upsell"],authorId:"emp-021",seed:true},
  {id:"evt-055",accountId:"acc-02",date:"2026-03-22",type:"deal",title:"Multigrain Atta exclusive listing",detail:"Nature's Basket to exclusively stock Nexa Multigrain Atta in their gourmet range.",tags:["decision-maker"],authorId:"emp-016",seed:true},
  {id:"evt-056",accountId:"acc-05",date:"2026-02-10",type:"call",title:"FoodWorld Chennai reorder",detail:"Monthly reorder call. Adding Idli Mix and Dosa Mix to regular order.",tags:["upsell"],authorId:"emp-019",seed:true},
  {id:"evt-057",accountId:"acc-07",date:"2026-03-05",type:"meeting",title:"WinMart Kerala expansion review",detail:"WinMart opening 3 new stores in Thrissur and Palakkad. Nexa to be preferred vendor.",tags:["upsell","champion"],authorId:"emp-016",seed:true},
  {id:"evt-058",accountId:"acc-09",date:"2026-01-20",type:"call",title:"Heritage Foods supply schedule",detail:"Confirmed monthly delivery schedule. 2 deliveries per month.",tags:[],authorId:"emp-017",seed:true},
  {id:"evt-059",accountId:"acc-09",date:"2026-05-28",type:"note",title:"OVERDUE INVOICE FOLLOW-UP",detail:"Invoice INV-0027 is now 8 days overdue. Called AP team — payment being processed.",tags:["at-risk","follow-up"],authorId:"emp-012",seed:true},
  {id:"evt-060",accountId:"acc-10",date:"2026-02-08",type:"meeting",title:"Spar vendor review",detail:"Positive review. Nexa shortlisted for Spar's annual preferred vendor program.",tags:["champion"],authorId:"emp-021",seed:true},
  {id:"evt-061",accountId:"acc-11",date:"2026-04-12",type:"call",title:"Ratnadeep expansion call",detail:"Ratnadeep opening 5 new outlets in Vizag. Nexa to supply all new stores from Hyderabad depot.",tags:["upsell"],authorId:"emp-020",seed:true},
  {id:"evt-062",accountId:"acc-12",date:"2026-02-25",type:"meeting",title:"KK Kitchens bulk order discussion",detail:"Discussed HoReCa-format 5kg atta and bulk spice packs (1kg pouches). Trial order confirmed.",tags:["hot"],authorId:"emp-021",seed:true},
  {id:"evt-063",accountId:"acc-15",date:"2026-03-15",type:"note",title:"QuickKart — seasonal push for Holi",detail:"QuickKart ran a special Holi campaign with Nexa atta bundles. 30% volume spike noted.",tags:["upsell"],authorId:"emp-024",seed:true},
  {id:"evt-064",accountId:"acc-17",date:"2026-02-20",type:"call",title:"Swiggy Instamart expansion cities",detail:"Instamart launching in Coimbatore, Madurai, and Mysuru. Nexa SKUs to go live immediately.",tags:["upsell","hot"],authorId:"emp-023",seed:true},
  {id:"evt-065",accountId:"acc-18",date:"2026-04-15",type:"meeting",title:"Zepto — 10-minute delivery integration",detail:"Zepto integrating Nexa products into their hyperlocal dark store model. 15 SKUs confirmed.",tags:["decision-maker"],authorId:"emp-023",seed:true},
  {id:"evt-066",accountId:"acc-19",date:"2026-01-12",type:"call",title:"JioMart onboarding call",detail:"JioMart FMCG team called to expand Nexa catalog from 5 to 18 SKUs.",tags:["upsell","hot"],authorId:"emp-024",seed:true},
  {id:"evt-067",accountId:"acc-20",date:"2026-03-08",type:"meeting",title:"Blinkit quarterly review",detail:"Strong performance in 10-minute delivery segment. Nexa Atta in top 5 for Blinkit's grocery category.",tags:["champion"],authorId:"emp-018",seed:true},
  {id:"evt-068",accountId:"acc-22",date:"2026-05-05",type:"call",title:"Star Bazaar May order",detail:"Monthly order confirmed. Adding Groundnut Oil 1L to the regular supply.",tags:["upsell"],authorId:"emp-023",seed:true},
  {id:"evt-069",accountId:"acc-25",date:"2026-04-10",type:"meeting",title:"NRI Bazaar USA — new SKUs",detail:"Video call with NRI Bazaar buyer. Adding Besan, Jowar Flour, and Ragi Flour to export range.",tags:["upsell","decision-maker"],authorId:"emp-020",seed:true},
  {id:"evt-070",accountId:"acc-26",date:"2026-02-15",type:"call",title:"Indian Grocery UK — quality review",detail:"UK customer very positive about product quality. Shelf life compliance confirmed at 12 months.",tags:["champion"],authorId:"emp-020",seed:true},
  {id:"evt-071",accountId:"acc-27",date:"2026-03-12",type:"email",title:"Apna Market SG — Hari Raya stock",detail:"Seasonal order for Hari Raya — doubled the usual atta and biryani masala quantity.",tags:["upsell","hot"],authorId:"emp-020",seed:true},
  {id:"evt-072",accountId:"acc-28",date:"2026-04-18",type:"meeting",title:"Desi Superstore Canada — label audit",detail:"Canadian food safety team reviewed labels. Minor changes needed for bilingual English/French labelling.",tags:["follow-up"],authorId:"emp-020",seed:true},
  {id:"evt-073",accountId:"acc-06",date:"2026-01-18",type:"call",title:"Spencer's Kolkata review",detail:"Regional buyer very happy with delivery consistency. Expanding to Spencer's Odisha stores.",tags:["upsell"],authorId:"emp-028",seed:true},
  {id:"evt-074",accountId:"acc-08",date:"2026-02-28",type:"meeting",title:"Nilgiris stores — product mix review",detail:"Nilgiris expanding health food section. Discussed listing Oats Granola, Puffed Amaranth, and Trail Mix.",tags:["upsell"],authorId:"emp-021",seed:true},
  {id:"evt-075",accountId:"acc-13",date:"2026-04-22",type:"deal",title:"BlueMart annual contract renewed",detail:"Annual supply contract renewed with 8% volume increase. Adding 5 new SKUs to regular supply.",tags:["decision-maker","renewal"],authorId:"emp-018",seed:true},
  {id:"evt-076",accountId:"acc-34",date:"2026-04-25",type:"call",title:"Taj Hotels — pilot order placed",detail:"Taj placed first pilot order for premium Garam Masala and Coconut Oil for select properties.",tags:["champion","hot"],authorId:"emp-033",seed:true},
  {id:"evt-077",accountId:"acc-35",date:"2026-05-10",type:"meeting",title:"Oberoi Hotels — final product tasting",detail:"Executive chef from Oberoi attended product tasting at Bengaluru plant. Very positive feedback.",tags:["decision-maker","hot"],authorId:"emp-016",seed:true},
  {id:"evt-078",accountId:"acc-36",date:"2026-05-20",type:"email",title:"CSD Canteen — tender submitted",detail:"Submitted formal tender for CSD (Army Canteen) preferred supplier status. ₹5.2 Cr potential.",tags:["hot","follow-up"],authorId:"emp-016",seed:true},
  {id:"evt-079",accountId:"acc-42",date:"2026-04-08",type:"meeting",title:"Supr Daily — subscription model fit",detail:"Supr Daily looking for consistent daily delivery partners. Nexa atta as daily essential product.",tags:["hot","decision-maker"],authorId:"emp-023",seed:true},
  {id:"evt-080",accountId:"acc-57",date:"2026-04-20",type:"email",title:"Flavors of India AUS — first contact",detail:"Australian retailer specializing in Indian products. Interest in complete Nexa product range.",tags:["intro","hot"],authorId:"emp-020",seed:true},
];

// ── LEAVE CONFIG ──────────────────────────────────────────────────────────────
const DEMO_LEAVE_CONFIG = [
  {id:"lt-cl",name:"Casual Leave",code:"CL",tone:"primary" as const,allowHalfDay:true,annualDays:12,paid:true,carryForward:false},
  {id:"lt-sl",name:"Sick Leave",code:"SL",tone:"warning" as const,allowHalfDay:true,annualDays:12,paid:true,carryForward:true},
  {id:"lt-el",name:"Earned Leave",code:"EL",tone:"success" as const,allowHalfDay:false,annualDays:18,paid:true,carryForward:true},
  {id:"lt-ml",name:"Maternity Leave",code:"ML",tone:"success" as const,allowHalfDay:false,annualDays:182,paid:true,carryForward:false},
  {id:"lt-pl",name:"Paternity Leave",code:"PL",tone:"primary" as const,allowHalfDay:false,annualDays:15,paid:true,carryForward:false},
  {id:"lt-co",name:"Compensatory Off",code:"CO",tone:"default" as const,allowHalfDay:true,annualDays:0,paid:true,carryForward:false},
  {id:"lt-lp",name:"Leave Without Pay",code:"LWP",tone:"danger" as const,allowHalfDay:true,annualDays:0,paid:false,carryForward:false},
];

// ── TAX FILINGS ───────────────────────────────────────────────────────────────
const DEMO_TAX_FILINGS = [
  {id:"gst-001",type:"GSTR-3B",period:"2026-01",entityId:"ent-1",filedOn:"2026-02-20",status:"filed",taxable:45000000,cgst:0,sgst:0,igst:4050000,cess:0,itc:2800000,net:1250000},
  {id:"gst-002",type:"GSTR-3B",period:"2026-02",entityId:"ent-1",filedOn:"2026-03-20",status:"filed",taxable:48000000,cgst:0,sgst:0,igst:4320000,cess:0,itc:2950000,net:1370000},
  {id:"gst-003",type:"GSTR-3B",period:"2026-03",entityId:"ent-1",filedOn:"2026-04-20",status:"filed",taxable:52000000,cgst:0,sgst:0,igst:4680000,cess:0,itc:3100000,net:1580000},
  {id:"gst-004",type:"GSTR-1",period:"2026-Q1",entityId:"ent-1",filedOn:"2026-04-12",status:"filed",taxable:145000000,cgst:0,sgst:0,igst:13050000,cess:0,itc:0,net:13050000},
  {id:"gst-005",type:"GSTR-3B",period:"2026-04",entityId:"ent-1",filedOn:"2026-05-20",status:"filed",taxable:49000000,cgst:0,sgst:0,igst:4410000,cess:0,itc:3050000,net:1360000},
  {id:"gst-006",type:"GSTR-3B",period:"2026-05",entityId:"ent-1",filedOn:"2026-06-20",status:"filed",taxable:55000000,cgst:0,sgst:0,igst:4950000,cess:0,itc:3400000,net:1550000},
];

// ── LOAD DEMO DATA ────────────────────────────────────────────────────────────
export function loadDemoData() {
  if (typeof window === "undefined") return;
  write("nexa-entities",       DEMO_ENTITIES);
  write("nexa-locations",      DEMO_LOCATIONS);
  write("nexa-vendors",        DEMO_VENDORS);
  write("nexa-items",          DEMO_ITEMS);
  write("nexa-bom",            DEMO_BOM);
  write("nexa-employees",      DEMO_EMPLOYEES);
  write("nexa-bank-accounts",  DEMO_BANK_ACCOUNTS);
  write("nexa-crm-accounts",   DEMO_ACCOUNTS);
  write("nexa-crm-contacts",   DEMO_CONTACTS);
  write("nexa-journal-entries",DEMO_JOURNAL_ENTRIES);
  write("nexa-inv-movements",  DEMO_MOVEMENTS);
  write("nexa-transfers",      DEMO_TRANSFERS);
  write("nexa-sc-grn",         DEMO_GRNS);
  write("nexa-added-pos",      DEMO_POS);
  write("nexa-invoices",       DEMO_INVOICES);
  write("nexa-assets",         DEMO_ASSETS);
  write("nexa-loans",          DEMO_LOANS);
  write("nexa-crm-events",     DEMO_CRM_EVENTS);
  write("nexa-leave-config",   DEMO_LEAVE_CONFIG);
  write("nexa-tax-filings",    DEMO_TAX_FILINGS);
  window.location.reload();
}

export const DEMO_MODULES = [
  "3 entities (Foods · Trading · Agro Exports)",
  "8 locations (plant · DC · depot · hub)",
  "25 vendors (RM · packaging · logistics · capex)",
  "140 inventory items + 75 BOMs",
  "100 employees across 14 departments",
  "75 CRM accounts + contacts",
  "3 bank accounts (HDFC · Axis · ICICI)",
  "33 sales invoices (Jan–Jun 2026)",
  "90 journal entries (payroll · rent · GST · dep)",
  "~190 stock movements (opening + 6 months)",
  "15 inter-location transfer orders",
  "20 goods receipt notes (with QC results)",
  "40 purchase orders (RM · PM · opex · capex)",
  "10 fixed assets (machinery · vehicles · IT)",
  "5 employee loans with EMI schedules",
  "80 CRM journey events (calls · meetings · deals)",
  "7 leave types configured",
  "6 GST filings (GSTR-1 · GSTR-3B)",
];

// ---------------------------------------------------------------------------
// Connections — the data-warehouse / ingestion layer.
//
// NEXA sits ON TOP of the accounting systems a business already runs (SAP,
// Tally, Zoho, QuickBooks, Xero, NetSuite). Each connector pulls the source's
// ledgers into a unified model, which then powers NEXA's reports & dashboards —
// a Power-BI-style warehouse for finance data.
//
// There is no live backend here: connection state and sync results are kept in
// localStorage and the fetched volumes are deterministic per connector, so the
// experience is realistic and stable across renders.
// ---------------------------------------------------------------------------

export type ConnectorCategory = "ERP" | "Accounting" | "SME" | "OMS";
export type AuthType = "OAuth 2.0" | "API token" | "Token + Company ID";

export interface DatasetVolume {
  accounts: number;
  journals: number;
  invoices: number;
  bills: number;
  contacts: number;
  orders: number;
}

export interface Connector {
  id: string;
  name: string;
  vendor: string;
  category: ConnectorCategory;
  color: string; // brand-ish colour for the monogram
  monogram: string;
  blurb: string;
  authType: AuthType;
  region: string;
  /** Record volumes a full sync pulls from this source (deterministic). */
  sample: DatasetVolume;
}

export const CONNECTORS: Connector[] = [
  {
    id: "sap",
    name: "SAP S/4HANA",
    vendor: "SAP",
    category: "ERP",
    color: "#0a6ed1",
    monogram: "SAP",
    blurb: "Enterprise ERP — GL, AP/AR, cost centres and profit centres.",
    authType: "OAuth 2.0",
    region: "Global",
    sample: { accounts: 1284, journals: 48210, invoices: 9120, bills: 7740, contacts: 3110, orders: 0 },
  },
  {
    id: "netsuite",
    name: "NetSuite",
    vendor: "Oracle",
    category: "ERP",
    color: "#1f6f43",
    monogram: "NS",
    blurb: "Oracle cloud ERP — multi-subsidiary GL, billing and procurement.",
    authType: "Token + Company ID",
    region: "Global",
    sample: { accounts: 940, journals: 31540, invoices: 6820, bills: 5210, contacts: 2480, orders: 0 },
  },
  {
    id: "tally",
    name: "Tally Prime",
    vendor: "Tally Solutions",
    category: "Accounting",
    color: "#c0392b",
    monogram: "TP",
    blurb: "India's SME standard — vouchers, GST, inventory and ledgers.",
    authType: "Token + Company ID",
    region: "India",
    sample: { accounts: 612, journals: 22870, invoices: 5140, bills: 4360, contacts: 1890, orders: 0 },
  },
  {
    id: "zoho",
    name: "Zoho Books",
    vendor: "Zoho",
    category: "Accounting",
    color: "#e07b39",
    monogram: "ZB",
    blurb: "Cloud accounting — invoices, bills, banking and GST returns.",
    authType: "OAuth 2.0",
    region: "Global",
    sample: { accounts: 410, journals: 14230, invoices: 4310, bills: 3120, contacts: 1540, orders: 0 },
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    vendor: "Intuit",
    category: "SME",
    color: "#2ca01c",
    monogram: "QB",
    blurb: "Small-business accounting — chart of accounts, sales and expenses.",
    authType: "OAuth 2.0",
    region: "Global",
    sample: { accounts: 320, journals: 11890, invoices: 3980, bills: 2640, contacts: 1320, orders: 0 },
  },
  {
    id: "xero",
    name: "Xero",
    vendor: "Xero",
    category: "SME",
    color: "#13b5ea",
    monogram: "XO",
    blurb: "Cloud accounting — bank feeds, invoicing and reconciliations.",
    authType: "OAuth 2.0",
    region: "Global",
    sample: { accounts: 286, journals: 10240, invoices: 3450, bills: 2210, contacts: 1180, orders: 0 },
  },

  // ---- Order Management Systems (commerce / fulfilment) ----
  {
    id: "unicommerce",
    name: "Unicommerce",
    vendor: "Unicommerce",
    category: "OMS",
    color: "#2d6cdf",
    monogram: "UC",
    blurb: "Multichannel order & warehouse management — orders, shipments, returns.",
    authType: "API token",
    region: "India",
    sample: { accounts: 0, journals: 0, invoices: 18600, bills: 0, contacts: 9400, orders: 42300 },
  },
  {
    id: "increff",
    name: "Increff Omni",
    vendor: "Increff",
    category: "OMS",
    color: "#6a3fd1",
    monogram: "IO",
    blurb: "Omni inventory & order orchestration across marketplaces and stores.",
    authType: "API token",
    region: "India",
    sample: { accounts: 0, journals: 0, invoices: 12100, bills: 0, contacts: 6200, orders: 28800 },
  },
  {
    id: "easyecom",
    name: "EasyEcom",
    vendor: "EasyEcom",
    category: "OMS",
    color: "#0e9f6e",
    monogram: "EE",
    blurb: "E-commerce OMS — order sync, picking/packing, courier and returns.",
    authType: "OAuth 2.0",
    region: "Global",
    sample: { accounts: 0, journals: 0, invoices: 8700, bills: 0, contacts: 4100, orders: 19500 },
  },
  {
    id: "shopify",
    name: "Shopify",
    vendor: "Shopify",
    category: "OMS",
    color: "#95bf47",
    monogram: "SH",
    blurb: "Storefront & order source — sales orders, customers and fulfilment.",
    authType: "OAuth 2.0",
    region: "Global",
    sample: { accounts: 0, journals: 0, invoices: 15200, bills: 0, contacts: 11800, orders: 33600 },
  },
];

export function connectorById(id: string): Connector | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

// The datasets the warehouse exposes to NEXA's reports, and which source
// records feed them.
export const DATASETS = [
  { id: "gl", name: "General Ledger", from: "journals", powers: "Trial Balance · P&L · Balance Sheet" },
  { id: "orders", name: "Sales Orders", from: "orders", powers: "Demand · Fulfilment · Revenue" },
  { id: "ar", name: "Receivables", from: "invoices", powers: "Aged AR · Cash Flow · Revenue" },
  { id: "ap", name: "Payables", from: "bills", powers: "Aged AP · Cash Flow · Cost Audit" },
  { id: "coa", name: "Chart of Accounts", from: "accounts", powers: "Account mapping · Statements" },
  { id: "parties", name: "Customers & Vendors", from: "contacts", powers: "Party ledgers · Sub-ledgers" },
] as const;

// A sample mapping of a source's chart of accounts onto NEXA's, shown in the
// "Configure mapping" drawer to make the ingestion concrete.
export const SAMPLE_MAPPING: Array<{ source: string; nexa: string; code: string }> = [
  { source: "Sales — Domestic", nexa: "Product Sales", code: "4010" },
  { source: "Sales — Export", nexa: "Export Sales", code: "4030" },
  { source: "Trade Debtors", nexa: "Accounts Receivable", code: "1100" },
  { source: "Trade Creditors", nexa: "Accounts Payable", code: "2010" },
  { source: "Bank — Operating", nexa: "Bank — Current Account", code: "1020" },
  { source: "Output GST / VAT", nexa: "GST Output Payable", code: "2100" },
  { source: "Cost of Sales", nexa: "Cost of Goods Sold", code: "5010" },
  { source: "Payroll", nexa: "Salaries & Wages", code: "6010" },
];

export function totalRecords(v: DatasetVolume): number {
  return v.accounts + v.journals + v.invoices + v.bills + v.contacts + v.orders;
}

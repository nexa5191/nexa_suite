import {
  Activity,
  LayoutDashboard,
  Calendar,
  ListTodo,
  ListTree,
  BookOpen,
  NotebookPen,
  Building2,
  PieChart,
  Target,
  FileText,
  Calculator,
  Landmark,
  Layers,
  ArrowLeftRight,
  Repeat,
  TrendingUp,
  Scale,
  Wallet,
  LineChart,
  Table2,
  BookUser,
  UserRound,
  Users,
  Clock,
  CalendarDays,
  Banknote,
  Coins,
  ReceiptText,
  FileSpreadsheet,
  Palmtree,
  ClipboardCheck,
  Contact,
  Handshake,
  HeartHandshake,
  Plug,
  ShoppingCart,
  Receipt,
  Warehouse,
  Truck,
  FolderOpen,
  ClipboardList,
  PackageCheck,
  PackageOpen,
  UserCircle,
  Settings,
  SlidersHorizontal,
  LifeBuoy,
  Briefcase,
  Timer,
  ScanLine,
  GitCompareArrows,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  Globe,
  Gauge,
  UserPlus,
  PiggyBank,
  Sliders,
  ShieldCheck,
  ScrollText,
  Gavel,
  Lock,
  Building,
  BookCopy,
  CalendarRange,
  FileSignature,
  AlignLeft,
  FileQuestion,
  BarChart3,
  Percent,
  Code2,
  ArrowRightLeft,
  CalendarClock,
  History,
  GitMerge,
  ArrowUpDown,
  Factory,
  QrCode,
  Settings2,
  RotateCcw,
  LayoutGrid,
  Store,
  PackageMinus,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Stable access key — what provisioning & RBAC are keyed on (NOT the URL). */
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optional sub-items rendered as an indented list below this item. */
  children?: Array<Omit<NavItem, "children">>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", href: "/", label: "Dashboard", icon: LayoutDashboard },
      { key: "calendar", href: "/calendar", label: "Calendar", icon: Calendar },
      { key: "tasks", href: "/tasks", label: "Tasks", icon: ListTodo },
    ],
  },
  {
    label: "Data & Integrations",
    items: [{ key: "connections", href: "/connections", label: "Connections", icon: Plug }],
  },
  {
    label: "Accounting",
    items: [
      { key: "chart-of-accounts", href: "/chart-of-accounts", label: "Chart of Accounts", icon: ListTree },
      { key: "general-ledger", href: "/journal", label: "General Ledger", icon: BookOpen },
      { key: "journal-entries", href: "/journal-entries", label: "Journal Entries", icon: NotebookPen },
      { key: "petty-cash", href: "/petty-cash", label: "Petty Cash Book", icon: Coins },
      { key: "reimbursements", href: "/reimbursements", label: "Reimbursements", icon: ReceiptText },
      { key: "contracts", href: "/contracts", label: "Contracts & AMCs", icon: FileSignature },
      { key: "fixed-assets", href: "/assets", label: "Fixed Assets", icon: Building2 },
      { key: "lease-accounting", href: "/leases", label: "Lease Accounting", icon: Building },
      { key: "multi-book", href: "/multi-book", label: "Multi-Book Ledger", icon: BookCopy },
      { key: "financial-close", href: "/financial-close", label: "Financial Close", icon: Lock },
      { key: "audit-trail", href: "/audit-trail", label: "Audit Trail", icon: History },
    ],
  },
  {
    label: "Tax & Compliance",
    items: [
      { key: "gst-tds", href: "/tax", label: "GST & TDS", icon: Landmark },
      { key: "gst-registers", href: "/tax/registers", label: "GST Registers", icon: FileSpreadsheet },
      { key: "e-invoicing", href: "/invoicing/e-invoicing", label: "e-Invoicing", icon: ScanLine },
      { key: "gstr2b-recon", href: "/tax/gstr2b", label: "GSTR-2B Match", icon: GitCompareArrows },
      { key: "eway-bill", href: "/tax/eway-bill", label: "E-way Bills", icon: ScrollText },
      { key: "tcs", href: "/tax/tcs", label: "TCS (Sec. 206C)", icon: Percent },
      { key: "advance-tax", href: "/tax/advance-tax", label: "Advance Tax", icon: CalendarClock },
      { key: "form-26q", href: "/tax/26q", label: "Form 26Q (Non-salary TDS)", icon: FileSpreadsheet },
      { key: "transfer-pricing", href: "/tax/transfer-pricing", label: "Transfer Pricing", icon: ArrowRightLeft },
      { key: "compliance-rules", href: "/compliance", label: "Compliance Rules", icon: ScrollText },
      { key: "compliance-calendar", href: "/compliance/calendar", label: "Compliance Calendar", icon: CalendarClock },
      { key: "mca-roc", href: "/compliance/mca", label: "MCA / ROC Filings", icon: Gavel },
    ],
  },
  {
    label: "Group & Treasury",
    items: [
      { key: "group-reporting", href: "/group", label: "Group Reporting", icon: Layers },
      { key: "intercompany", href: "/group/intercompany", label: "Inter-company", icon: ArrowLeftRight },
      { key: "bank-recon", href: "/banking", label: "Bank Reconciliation", icon: Repeat },
      { key: "payment-runs", href: "/payments", label: "Payment Runs", icon: Send },
    ],
  },
  {
    label: "Sales & Revenue",
    items: [
      { key: "crm", href: "/crm", label: "CRM", icon: HeartHandshake },
      { key: "orders", href: "/orders", label: "Orders", icon: ShoppingCart },
      { key: "customer-returns", href: "/orders/returns", label: "Customer Returns", icon: RotateCcw },
      { key: "invoicing", href: "/invoicing", label: "Invoicing", icon: Receipt },
      { key: "delivery-challan", href: "/invoicing/delivery-challan", label: "Delivery Challans", icon: Truck },
      { key: "revenue-recognition", href: "/revenue-recognition", label: "Revenue Recognition", icon: CalendarRange },
    ],
  },
  {
    label: "Professional Services",
    items: [
      { key: "projects", href: "/projects", label: "Engagements", icon: Briefcase },
      { key: "timesheets", href: "/timesheets", label: "Timesheets", icon: Timer },
    ],
  },
  {
    label: "Planning & Analysis",
    items: [
      { key: "cost-audit", href: "/analysis/cost-audit", label: "Cost Audit", icon: PieChart },
      { key: "capital-decisions", href: "/planning/decisions", label: "Capital Decisions", icon: Calculator },
      { key: "budget", href: "/planning/budget", label: "Budget & Forecast", icon: Target },
      { key: "budget-builder", href: "/finance/budgetbuilder", label: "Budget Builder", icon: FileSpreadsheet },
      { key: "budget-control", href: "/planning/budget-control", label: "Budgetary Control", icon: ShoppingCart },
      { key: "business-plan", href: "/planning/business-plan", label: "Business Plan", icon: FileText },
      { key: "saop", href: "/planning/saop", label: "S&OP / Forecast", icon: TrendingUp },
      { key: "capacity-planning", href: "/planning/capacity", label: "Capacity Planning", icon: Factory },
      { key: "machine-utilisation", href: "/planning/machine-utilisation", label: "Machine Utilisation", icon: Gauge },
    ],
  },
  {
    label: "Reports",
    items: [
      { key: "profit-loss", href: "/reports/profit-loss", label: "Profit & Loss", icon: TrendingUp },
      { key: "balance-sheet", href: "/reports/balance-sheet", label: "Balance Sheet", icon: Scale },
      { key: "cash-flow", href: "/reports/cash-flow", label: "Cash Flow", icon: Wallet },
      { key: "trial-balance", href: "/reports/trial-balance", label: "Trial Balance", icon: AlignLeft },
      { key: "notes-to-accounts", href: "/reports/notes", label: "Notes to Accounts", icon: FileQuestion },
      { key: "cashflow-forecast", href: "/reports/cashflow-forecast", label: "Projected Cash Flow", icon: LineChart },
      { key: "report-explorer", href: "/reports/explorer", label: "Report Explorer", icon: Table2 },
      { key: "party-ledger", href: "/reports/ledgers", label: "Party Ledger", icon: BookUser },
      { key: "segment-pnl", href: "/reports/segments", label: "P&L by Segment", icon: PieChart },
      { key: "receivables", href: "/receivables", label: "Receivables", icon: ArrowDownToLine },
      { key: "payables", href: "/payables", label: "Payables", icon: ArrowUpFromLine },
      { key: "fx-revaluation", href: "/reports/fx-revaluation", label: "FX Revaluation", icon: Globe },
      { key: "dcf", href: "/reports/dcf", label: "DCF Valuation", icon: Activity },
      { key: "kpi-builder", href: "/reports/kpi-builder", label: "Custom KPIs", icon: Sliders },
    ],
  },
  {
    label: "People & HR",
    items: [
      { key: "hr-overview", href: "/hr", label: "HR Overview", icon: UserRound },
      { key: "directory", href: "/people", label: "Directory", icon: Users },
      { key: "attendance", href: "/hr/attendance", label: "Attendance", icon: Clock },
      { key: "leave", href: "/leave", label: "Leave", icon: CalendarDays },
      { key: "payroll", href: "/hr/payroll", label: "Payroll", icon: Banknote },
      { key: "payroll-statutory", href: "/hr/payroll/statutory", label: "Payroll Statutory", icon: ShieldCheck },
      { key: "loans", href: "/hr/loans", label: "Loans & Advances", icon: PiggyBank },
      { key: "performance", href: "/hr/performance", label: "Performance & OKRs", icon: Gauge },
      { key: "onboarding", href: "/hr/onboarding", label: "Onboarding & Offboarding", icon: UserPlus },
      { key: "holidays", href: "/hr/holidays", label: "Holidays", icon: Palmtree },
      { key: "leave-policy", href: "/leave/config", label: "Leave Policy", icon: Settings2 },
      { key: "cv-bank", href: "/cv-bank", label: "CV Bank", icon: Contact },
      { key: "agency-portal", href: "/agency-portal", label: "Agency Portal", icon: Handshake },
      { key: "approvals", href: "/approvals", label: "Approvals", icon: ClipboardCheck },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        key: "inventory", href: "/inventory", label: "Inventory", icon: Warehouse,
        children: [
          { key: "purchase-requisitions", href: "/inventory/requisitions", label: "Purchase Requisitions", icon: ClipboardList },
          { key: "goods-receipts", href: "/inventory/grn", label: "Goods Receipts", icon: PackageCheck },
          { key: "stock-count", href: "/inventory/stock-count", label: "Stock Count", icon: ClipboardCheck },
          { key: "material-issues", href: "/inventory/issues", label: "Material Issues", icon: PackageOpen },
          { key: "bom", href: "/inventory/bom", label: "Bill of Materials", icon: GitMerge },
          { key: "inventory-costing", href: "/inventory/costing", label: "Inventory Costing", icon: Calculator },
          { key: "stock-movements", href: "/inventory/movements", label: "Stock Ledger", icon: ArrowUpDown },
          { key: "demand-planning", href: "/inventory/planning", label: "Demand Planning", icon: BarChart3 },
          { key: "production", href: "/inventory/production", label: "Production", icon: Factory },
          { key: "traceability", href: "/inventory/traceability", label: "Batch Traceability", icon: QrCode },
          { key: "bins", href: "/inventory/bins", label: "Bin / Rack Management", icon: LayoutGrid },
          { key: "putaway", href: "/inventory/putaway", label: "Put-away & Picking", icon: PackageOpen },
          { key: "transfers", href: "/inventory/transfers", label: "Inter-warehouse Transfers", icon: ArrowRightLeft },
          { key: "rtv", href: "/inventory/rtv", label: "Return to Vendor (RTV)", icon: PackageMinus },
          { key: "consignment", href: "/inventory/consignment", label: "Consignment / VMI", icon: Store },
        ],
      },
      {
        key: "vendors", href: "/vendors", label: "Vendors", icon: Truck,
        children: [
          { key: "vendor-portal", href: "/vendor-portal", label: "Vendor Portal", icon: Globe },
          { key: "advance-payments", href: "/vendors/advances", label: "Advance Payments", icon: Wallet },
        ],
      },
      { key: "documents", href: "/documents", label: "Documents", icon: FolderOpen },
    ],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  { key: "portal", href: "/portal", label: "My Portal", icon: UserCircle },
  { key: "auditor-portal", href: "/auditor", label: "Auditor Portal", icon: Gavel },
  { key: "setup", href: "/setup", label: "Access & Setup", icon: SlidersHorizontal },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
  { key: "help", href: "/help", label: "Help", icon: LifeBuoy },
];

/**
 * Quick "Create …" actions surfaced in the Cmd+K palette. Each either points at
 * a create route (e.g. the invoice builder) or deep-links to a module with
 * `?new=1`, which that module honours by opening its create form on load.
 */
export const COMMAND_ACTIONS: NavItem[] = [
  { key: "new-invoice", href: "/invoicing/new", label: "New Invoice", icon: Receipt },
  { key: "new-journal-entry-action", href: "/journal-entries?new=1", label: "New Journal Entry", icon: NotebookPen },
  { key: "new-task-action", href: "/tasks?new=1", label: "New Task", icon: ListTodo },
  { key: "new-reimbursement", href: "/reimbursements?new=1", label: "New Reimbursement Claim", icon: ReceiptText },
  { key: "new-petty-cash", href: "/petty-cash?new=1", label: "Record Petty Cash Expense", icon: Coins },
  { key: "new-asset", href: "/assets?new=1", label: "New Fixed Asset", icon: Building2 },
  { key: "new-leave", href: "/leave?new=1", label: "New Leave Request", icon: CalendarDays },
  { key: "new-loan", href: "/hr/loans?new=1", label: "New Loan / Advance", icon: PiggyBank },
  { key: "new-grn", href: "/inventory/grn?new=1", label: "New Goods Receipt (GRN)", icon: PackageCheck },
  { key: "new-pr", href: "/inventory/requisitions?new=1", label: "New Purchase Requisition", icon: ClipboardList },
  { key: "new-stock-count", href: "/inventory/stock-count?new=1", label: "New Stock Count", icon: ClipboardCheck },
  { key: "new-material-issue", href: "/inventory/issues?new=1", label: "New Material Issue", icon: PackageOpen },
  { key: "new-crm-account", href: "/crm?new=1", label: "New CRM Account / Lead", icon: HeartHandshake },
  { key: "new-vendor", href: "/vendors?new=1", label: "New Vendor", icon: Truck },
  { key: "new-po", href: "/vendors?new-po=1", label: "New Purchase Order", icon: ShoppingCart },
  { key: "new-bom", href: "/inventory/bom?new=1", label: "New Bill of Materials", icon: GitMerge },
  { key: "new-production-order", href: "/inventory/production?new=1", label: "New Production Order", icon: Factory },
];

export const FLAT_NAV: NavItem[] = NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((item) => [item, ...(item.children ?? [])])
);

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /hr should not stay active on /hr/payroll etc.; match exact for the hub
  if (href === "/hr") return pathname === "/hr";
  // /journal must not stay active on /journal-entries (separate page).
  if (href === "/journal") return pathname === "/journal";
  // /tax must not stay active on /tax/registers or any other sub-page.
  if (href === "/tax") return pathname === "/tax";
  // /compliance must not stay active on /compliance/calendar or /compliance/mca.
  if (href === "/compliance") return pathname === "/compliance";
  // /portal must not stay active on /portal/tax-calculator (separate page).
  if (href === "/portal") return pathname === "/portal";
  // /hr/payroll must not stay active on /hr/payroll/statutory (separate page).
  if (href === "/hr/payroll") return pathname === "/hr/payroll";
  // /invoicing must not stay active on /invoicing/e-invoicing (separate page);
  // it stays active for the new-invoice builder.
  if (href === "/invoicing") return pathname === "/invoicing" || pathname.startsWith("/invoicing/new");
  // /orders must not stay active on /orders/returns.
  if (href === "/orders") return pathname === "/orders";
  // /vendors must not stay active on /vendors/advances.
  if (href === "/vendors") return pathname === "/vendors";
  return pathname.startsWith(href);
}

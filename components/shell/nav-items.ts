import {
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
  Table2,
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
  ShieldCheck,
  ScrollText,
  Gavel,
  FileClock,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Stable access key — what provisioning & RBAC are keyed on (NOT the URL). */
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
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
      { key: "fixed-assets", href: "/assets", label: "Fixed Assets", icon: Building2 },
    ],
  },
  {
    label: "Tax & Compliance",
    items: [
      { key: "gst-tds", href: "/tax", label: "GST & TDS", icon: Landmark },
      { key: "gst-registers", href: "/tax/registers", label: "GST Registers", icon: FileSpreadsheet },
      { key: "e-invoicing", href: "/invoicing/e-invoicing", label: "e-Invoicing", icon: ScanLine },
      { key: "gstr2b-recon", href: "/tax/gstr2b", label: "GSTR-2B Match", icon: GitCompareArrows },
      { key: "compliance-rules", href: "/compliance", label: "Compliance Rules", icon: ScrollText },
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
      { key: "invoicing", href: "/invoicing", label: "Invoicing", icon: Receipt },
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
      { key: "business-plan", href: "/planning/business-plan", label: "Business Plan", icon: FileText },
    ],
  },
  {
    label: "Reports",
    items: [
      { key: "profit-loss", href: "/reports/profit-loss", label: "Profit & Loss", icon: TrendingUp },
      { key: "balance-sheet", href: "/reports/balance-sheet", label: "Balance Sheet", icon: Scale },
      { key: "cash-flow", href: "/reports/cash-flow", label: "Cash Flow", icon: Wallet },
      { key: "report-explorer", href: "/reports/explorer", label: "Report Explorer", icon: Table2 },
      { key: "receivables", href: "/receivables", label: "Receivables", icon: ArrowDownToLine },
      { key: "payables", href: "/payables", label: "Payables", icon: ArrowUpFromLine },
      { key: "fx-revaluation", href: "/reports/fx-revaluation", label: "FX Revaluation", icon: Globe },
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
      { key: "cv-bank", href: "/cv-bank", label: "CV Bank", icon: Contact },
      { key: "agency-portal", href: "/agency-portal", label: "Agency Portal", icon: Handshake },
      { key: "approvals", href: "/approvals", label: "Approvals", icon: ClipboardCheck },
    ],
  },
  {
    label: "Workspace",
    items: [
      { key: "inventory", href: "/inventory", label: "Inventory", icon: Warehouse },
      { key: "vendors", href: "/vendors", label: "Vendors", icon: Truck },
      { key: "documents", href: "/documents", label: "Documents", icon: FolderOpen },
    ],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  { key: "portal", href: "/portal", label: "My Portal", icon: UserCircle },
  { key: "audit-trail", href: "/audit-trail", label: "Audit Trail", icon: FileClock },
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
];

export const FLAT_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /hr should not stay active on /hr/payroll etc.; match exact for the hub
  if (href === "/hr") return pathname === "/hr";
  // /journal must not stay active on /journal-entries (separate page).
  if (href === "/journal") return pathname === "/journal";
  // /tax must not stay active on /tax/registers (separate page).
  if (href === "/tax") return pathname === "/tax";
  // /portal must not stay active on /portal/tax-calculator (separate page).
  if (href === "/portal") return pathname === "/portal";
  // /hr/payroll must not stay active on /hr/payroll/statutory (separate page).
  if (href === "/hr/payroll") return pathname === "/hr/payroll";
  // /invoicing must not stay active on /invoicing/e-invoicing (separate page);
  // it stays active for the new-invoice builder.
  if (href === "/invoicing") return pathname === "/invoicing" || pathname.startsWith("/invoicing/new");
  return pathname.startsWith(href);
}

import {
  LayoutDashboard,
  Calendar,
  ListTodo,
  ListTree,
  BookOpen,
  Building2,
  PieChart,
  Target,
  FileText,
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
  Palmtree,
  ClipboardCheck,
  Contact,
  HeartHandshake,
  Receipt,
  Warehouse,
  Truck,
  FolderOpen,
  UserCircle,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
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
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/tasks", label: "Tasks", icon: ListTodo },
    ],
  },
  {
    label: "Accounting",
    items: [
      { href: "/chart-of-accounts", label: "Chart of Accounts", icon: ListTree },
      { href: "/journal", label: "General Ledger", icon: BookOpen },
      { href: "/assets", label: "Fixed Assets", icon: Building2 },
    ],
  },
  {
    label: "Tax & Compliance",
    items: [{ href: "/tax", label: "GST & TDS", icon: Landmark }],
  },
  {
    label: "Group & Treasury",
    items: [
      { href: "/group", label: "Group Reporting", icon: Layers },
      { href: "/group/intercompany", label: "Inter-company", icon: ArrowLeftRight },
      { href: "/banking", label: "Bank Reconciliation", icon: Repeat },
    ],
  },
  {
    label: "Sales & Revenue",
    items: [
      { href: "/crm", label: "CRM", icon: HeartHandshake },
      { href: "/invoicing", label: "Invoicing", icon: Receipt },
    ],
  },
  {
    label: "Planning & Analysis",
    items: [
      { href: "/analysis/cost-audit", label: "Cost Audit", icon: PieChart },
      { href: "/planning/budget", label: "Budget & Forecast", icon: Target },
      { href: "/planning/business-plan", label: "Business Plan", icon: FileText },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports/profit-loss", label: "Profit & Loss", icon: TrendingUp },
      { href: "/reports/balance-sheet", label: "Balance Sheet", icon: Scale },
      { href: "/reports/cash-flow", label: "Cash Flow", icon: Wallet },
      { href: "/reports/explorer", label: "Report Explorer", icon: Table2 },
    ],
  },
  {
    label: "People & HR",
    items: [
      { href: "/hr", label: "HR Overview", icon: UserRound },
      { href: "/people", label: "Directory", icon: Users },
      { href: "/hr/attendance", label: "Attendance", icon: Clock },
      { href: "/leave", label: "Leave", icon: CalendarDays },
      { href: "/hr/payroll", label: "Payroll", icon: Banknote },
      { href: "/hr/holidays", label: "Holidays", icon: Palmtree },
      { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
    ],
  },
  {
    label: "Talent",
    items: [{ href: "/cv-bank", label: "CV Bank", icon: Contact }],
  },
  {
    label: "Workspace",
    items: [
      { href: "/inventory", label: "Inventory", icon: Warehouse },
      { href: "/vendors", label: "Vendors", icon: Truck },
      { href: "/documents", label: "Documents", icon: FolderOpen },
    ],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/portal", label: "My Portal", icon: UserCircle },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: LifeBuoy },
];

export const FLAT_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /hr should not stay active on /hr/payroll etc.; match exact for the hub
  if (href === "/hr") return pathname === "/hr";
  return pathname.startsWith(href);
}

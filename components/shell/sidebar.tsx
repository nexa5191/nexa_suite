"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { NAV_GROUPS, SECONDARY_NAV, isNavActive, type NavItem } from "./nav-items";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { useAccess } from "@/components/access/access-provider";

export function Sidebar({ side = "left" }: { side?: "left" | "right" }) {
  const pathname = usePathname();
  const isRight = side === "right";
  const { can } = useAccess();

  // Only show functions the acting user can reach; drop now-empty groups.
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.key)) })).filter(
    (g) => g.items.length > 0,
  );

  const activeGroup = groups.find((g) => g.items.some((i) => isNavActive(pathname, i.href)))?.label;

  // Hover-accordion: hovering a group expands it and collapses the rest. When
  // nothing is hovered, the group holding the current page stays open.
  const [hovered, setHovered] = useState<string | null>(null);
  const expandedLabel = hovered ?? activeGroup;

  const renderLink = (item: NavItem) => {
    const active = isNavActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <item.icon className="size-[18px] shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <aside
      data-chrome
      className={cn(
        "sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-card md:flex",
        isRight ? "order-last border-l" : "border-r",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-2" onMouseLeave={() => setHovered(null)}>
        {groups.map((group) => {
          const isOpen = expandedLabel === group.label;
          const groupActive = group.items.some((i) => isNavActive(pathname, i.href));
          return (
            <div key={group.label} className="mb-0.5" onMouseEnter={() => setHovered(group.label)}>
              <div
                className={cn(
                  "flex cursor-default items-center justify-between rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  isOpen || groupActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                  {group.label}
                  {groupActive && !isOpen && <span className="size-1.5 rounded-full bg-primary" />}
                </span>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", isOpen ? "rotate-0" : "-rotate-90")} />
              </div>
              {/* Smoothly clip the submenu; only the open group shows its items. */}
              <ul
                className={cn(
                  "overflow-hidden transition-all duration-200 ease-out",
                  isOpen ? "max-h-[640px] opacity-100" : "max-h-0 opacity-0",
                )}
              >
                <div className="space-y-0.5 pb-1 pl-1">{group.items.map(renderLink)}</div>
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t px-3 py-2">
        <ul className="space-y-0.5">{SECONDARY_NAV.map(renderLink)}</ul>
      </div>
    </aside>
  );
}

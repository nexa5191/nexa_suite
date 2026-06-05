"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FLAT_NAV, SECONDARY_NAV, isNavActive } from "./nav-items";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

// Top navigation layout — horizontal scrolling ribbon under the topbar.
export function Ribbon() {
  const pathname = usePathname();
  const items = [...FLAT_NAV, ...SECONDARY_NAV];
  return (
    <div className="sticky top-0 z-30 hidden border-b bg-card/95 backdrop-blur md:block">
      <div className="flex h-14 items-center gap-4 px-4">
        <Logo />
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
          {items.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

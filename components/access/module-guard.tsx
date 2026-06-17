"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, SlidersHorizontal } from "lucide-react";
import { useAccess } from "./access-provider";
import { owningNavKey, moduleIdForKey, MODULES } from "@/lib/modules";
import { Button } from "@/components/ui/button";

/**
 * Wraps page content and blocks it when the acting user can't reach the
 * function that owns the current route. Disabled functions are already hidden
 * from the nav; this stops someone reaching them by typing the URL. The reason
 * shown depends on WHY it's blocked: not provisioned (org-level) vs not granted
 * to your role.
 */
export function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hydrated, can, tenantEnabled, currentRole } = useAccess();

  // Avoid a flash of "no access" before localStorage hydrates.
  if (!hydrated) return <>{children}</>;

  const key = owningNavKey(pathname);
  if (!key || can(key)) return <>{children}</>;

  const provisioned = tenantEnabled(key);
  const moduleLabel = MODULES.find((m) => m.id === moduleIdForKey(key))?.label ?? "this module";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold">This function isn’t available</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {provisioned ? (
          <>
            Your role{currentRole ? ` (${currentRole.label})` : ""} doesn’t include the{" "}
            <strong>{moduleLabel}</strong> module. Ask an admin to grant it.
          </>
        ) : (
          <>
            The <strong>{moduleLabel}</strong> module hasn’t been enabled for your organisation yet.
          </>
        )}
      </p>
      <Link href="/setup" className="mt-5">
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-3.5" /> Open Access &amp; Setup
        </Button>
      </Link>
    </div>
  );
}

"use client";

import { usePrefs } from "@/components/prefs/prefs-provider";
import { Sidebar } from "./sidebar";
import { Ribbon } from "./ribbon";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { nav } = usePrefs();

  if (nav === "top") {
    return (
      <div className="min-h-screen">
        <Ribbon />
        <Topbar />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6">{children}</main>
      </div>
    );
  }

  // left or right sidebar
  return (
    <div className="flex min-h-screen">
      {nav === "left" && <Sidebar side="left" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">{children}</main>
      </div>
      {nav === "right" && <Sidebar side="right" />}
    </div>
  );
}

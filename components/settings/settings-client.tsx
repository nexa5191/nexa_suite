"use client";

import Link from "next/link";
import { Palette, Type, LayoutTemplate, Building2, CalendarCog, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ColorStudio } from "@/components/theme/color-studio";
import { FontSetting } from "@/components/theme/font-setting";
import { NavLayoutSetting } from "@/components/shell/nav-layout-setting";
import { DataResetCard } from "@/components/settings/data-reset-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ENTITIES, LOCATIONS } from "@/lib/accounting/org";

export function SettingsClient() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Personalise the look, layout and review your organisation." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="size-4" /> Theme Studio</CardTitle>
            <CardDescription>Accent colour, light/dark mode and corner radius — applied instantly.</CardDescription>
          </CardHeader>
          <CardContent>
            <ColorStudio />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LayoutTemplate className="size-4" /> Navigation Layout</CardTitle>
              <CardDescription>Choose where the primary navigation sits.</CardDescription>
            </CardHeader>
            <CardContent>
              <NavLayoutSetting />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Type className="size-4" /> Typography</CardTitle>
              <CardDescription>Pick the interface font.</CardDescription>
            </CardHeader>
            <CardContent>
              <FontSetting />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarCog className="size-4" /> Leave Policy</CardTitle>
          <CardDescription>Define leave types, allocations and half/full-day rules used across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/leave/config">
            <Button variant="outline" size="sm">Configure leave policy <ArrowRight className="size-3.5" /></Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="size-4" /> Organisation</CardTitle>
          <CardDescription>Entities, locations and states currently configured.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ENTITIES.map((e) => (
              <div key={e.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{e.name}</p>
                  <Badge variant="primary">{e.currency}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{e.legalName}</p>
                {e.gstin && <p className="mt-1 font-mono text-[11px] text-muted-foreground">GSTIN {e.gstin}</p>}
                <div className="mt-2 space-y-1 border-t pt-2">
                  {LOCATIONS.filter((l) => l.entityId === e.id).map((l) => (
                    <p key={l.id} className="flex items-center justify-between text-xs">
                      <span>{l.name}</span>
                      <span className="text-muted-foreground">{l.state}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DataResetCard />
    </>
  );
}

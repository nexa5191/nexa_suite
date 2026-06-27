import { WORK_CENTRES, CAPACITY_LOADS, availableHoursPerWeek, type WorkCentre, type CapacityLoad } from "@/lib/planning/capacity";

export interface MachineUtilRow {
  workCentreId: string;
  name: string;
  locationId: string;
  resourceType: "machine" | "labour";
  shiftPattern: string;
  availableHours: number;
  plannedHours: number;
  actualHours: number;
  utilPct: number;
  idleHours: number;
  costPerHour: number;
  plannedCost: number;
  actualCost: number;
  overloadFlag: boolean;
}

export interface MachineUtilReport {
  week: string;
  rows: MachineUtilRow[];
  totalAvailable: number;
  totalActual: number;
  avgUtilPct: number;
  overloadedCount: number;
  totalActualCost: number;
}

export function machineUtilReport(week: string): MachineUtilReport {
  const rows: MachineUtilRow[] = [];

  for (const wc of WORK_CENTRES) {
    const availableHours = availableHoursPerWeek(wc);
    const load: CapacityLoad | undefined = CAPACITY_LOADS.find(
      (l) => l.workCentreId === wc.id && l.week === week,
    );
    const plannedHours = load?.plannedHours ?? 0;
    const actualHours = load?.actualHours ?? 0;
    const utilPct = availableHours > 0 ? (actualHours / availableHours) * 100 : 0;

    rows.push({
      workCentreId: wc.id,
      name: wc.name,
      locationId: wc.locationId,
      resourceType: wc.resourceType,
      shiftPattern: wc.shiftPattern,
      availableHours,
      plannedHours,
      actualHours,
      utilPct: Math.round(utilPct * 10) / 10,
      idleHours: Math.max(0, availableHours - actualHours),
      costPerHour: wc.costPerHour,
      plannedCost: Math.round(plannedHours * wc.costPerHour),
      actualCost: Math.round(actualHours * wc.costPerHour),
      overloadFlag: utilPct > 100,
    });
  }

  const totalAvailable = rows.reduce((s, r) => s + r.availableHours, 0);
  const totalActual = rows.reduce((s, r) => s + r.actualHours, 0);
  const avgUtilPct =
    totalAvailable > 0 ? Math.round((totalActual / totalAvailable) * 1000) / 10 : 0;

  return {
    week,
    rows,
    totalAvailable,
    totalActual,
    avgUtilPct,
    overloadedCount: rows.filter((r) => r.overloadFlag).length,
    totalActualCost: rows.reduce((s, r) => s + r.actualCost, 0),
  };
}

export function availableWeeks(): string[] {
  return [...new Set(CAPACITY_LOADS.map((l) => l.week))].sort();
}

import type { Entity, Location } from "./types";

// Multi-entity, multi-location, multi-state organisation tree.

export const ENTITIES: Entity[] = [
  {
    id: "ent-nexa-in",
    name: "Nexa Foods",
    legalName: "Nexa Foods Pvt Ltd",
    currency: "INR",
    country: "India",
    gstin: "29ABCDE1234F1Z5",
  },
  {
    id: "ent-nexa-trade",
    name: "Nexa Trading",
    legalName: "Nexa Trading LLP",
    currency: "INR",
    country: "India",
    gstin: "27ABCDE1234F2Z3",
  },
  {
    id: "ent-nexa-global",
    name: "Nexa Global",
    legalName: "Nexa Global Pte Ltd",
    currency: "SGD",
    country: "Singapore",
  },
];

export const LOCATIONS: Location[] = [
  { id: "loc-blr", entityId: "ent-nexa-in", name: "Bengaluru HQ", city: "Bengaluru", state: "Karnataka", stateCode: "29" },
  { id: "loc-mys", entityId: "ent-nexa-in", name: "Mysuru Plant", city: "Mysuru", state: "Karnataka", stateCode: "29" },
  { id: "loc-mum", entityId: "ent-nexa-trade", name: "Mumbai Depot", city: "Mumbai", state: "Maharashtra", stateCode: "27" },
  { id: "loc-del", entityId: "ent-nexa-trade", name: "Delhi Branch", city: "New Delhi", state: "Delhi", stateCode: "07" },
  { id: "loc-sg", entityId: "ent-nexa-global", name: "Singapore Office", city: "Singapore", state: "Singapore", stateCode: "SG" },
];

export const ALL = "all";

export function entityById(id: string) {
  return ENTITIES.find((e) => e.id === id);
}

export function locationById(id: string) {
  return LOCATIONS.find((l) => l.id === id);
}

export function locationsForEntity(entityId: string) {
  if (entityId === ALL) return LOCATIONS;
  return LOCATIONS.filter((l) => l.entityId === entityId);
}

export function statesForEntity(entityId: string) {
  const locs = locationsForEntity(entityId);
  return Array.from(new Set(locs.map((l) => l.state)));
}

export const ALL_STATES = Array.from(new Set(LOCATIONS.map((l) => l.state)));

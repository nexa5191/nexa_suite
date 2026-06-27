import type { Entity, Location } from "./types";

// Multi-entity, multi-location, multi-state organisation tree.
// "Group" entities are those that have children (parentId set on children).
// resolveEntityIds() expands a group ID to include itself + all children,
// so any filter that calls it automatically handles rollup.

export const ENTITIES: Entity[] = [
  // ── Standalone legal entities ─────────────────────────────────────────────
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
  // ── Nexa Foods outlets (parentId → treated as rollup children) ────────────
  {
    id: "ent-nexa-pune",
    name: "Pune Outlet",
    legalName: "Nexa Foods - Pune",
    currency: "INR",
    country: "India",
    gstin: "27ABCDE1234F3Z1",
    parentId: "ent-nexa-in",
  },
  {
    id: "ent-nexa-hyd",
    name: "Hyderabad Outlet",
    legalName: "Nexa Foods - Hyderabad",
    currency: "INR",
    country: "India",
    gstin: "36ABCDE1234F4Z9",
    parentId: "ent-nexa-in",
  },
  {
    id: "ent-nexa-chn",
    name: "Chennai Outlet",
    legalName: "Nexa Foods - Chennai",
    currency: "INR",
    country: "India",
    gstin: "33ABCDE1234F5Z7",
    parentId: "ent-nexa-in",
  },
];

export const LOCATIONS: Location[] = [
  // Nexa Foods HQ locations
  { id: "loc-blr", entityId: "ent-nexa-in",    name: "Bengaluru HQ",         city: "Bengaluru", state: "Karnataka",    stateCode: "29" },
  { id: "loc-mys", entityId: "ent-nexa-in",    name: "Mysuru Plant",          city: "Mysuru",    state: "Karnataka",    stateCode: "29" },
  // Nexa Trading locations
  { id: "loc-mum", entityId: "ent-nexa-trade", name: "Mumbai Depot",          city: "Mumbai",    state: "Maharashtra",  stateCode: "27" },
  { id: "loc-del", entityId: "ent-nexa-trade", name: "Delhi Branch",          city: "New Delhi", state: "Delhi",        stateCode: "07" },
  // Nexa Global
  { id: "loc-sg",  entityId: "ent-nexa-global",name: "Singapore Office",      city: "Singapore", state: "Singapore",    stateCode: "SG" },
  // Nexa Foods outlets
  { id: "loc-pune",entityId: "ent-nexa-pune",  name: "Pune Outlet",           city: "Pune",      state: "Maharashtra",  stateCode: "27" },
  { id: "loc-hyd", entityId: "ent-nexa-hyd",   name: "Hyderabad Outlet",      city: "Hyderabad", state: "Telangana",    stateCode: "36" },
  { id: "loc-chn", entityId: "ent-nexa-chn",   name: "Chennai Outlet",        city: "Chennai",   state: "Tamil Nadu",   stateCode: "33" },
];

export const ALL = "all";

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export function entityById(id: string) {
  return ENTITIES.find((e) => e.id === id);
}

export function locationById(id: string) {
  return LOCATIONS.find((l) => l.id === id);
}

/** Direct child entities (outlets) of a parent entity. */
export function childEntities(parentId: string): Entity[] {
  return ENTITIES.filter((e) => e.parentId === parentId);
}

/** True when this entity has outlets (is a rollup group). */
export function isGroupEntity(id: string): boolean {
  return ENTITIES.some((e) => e.parentId === id);
}

/** Top-level entities — those without a parentId. */
export function topLevelEntities(): Entity[] {
  return ENTITIES.filter((e) => !e.parentId);
}

/**
 * Expand an entityId to the set of leaf entity IDs that should be included
 * when filtering data.
 *   "all"            → every entity's ID
 *   group entity ID  → that entity + all its children
 *   leaf entity ID   → just that entity
 */
export function resolveEntityIds(id: string): string[] {
  if (id === ALL) return ENTITIES.map((e) => e.id);
  const children = childEntities(id);
  return children.length > 0 ? [id, ...children.map((c) => c.id)] : [id];
}

export function locationsForEntity(entityId: string): Location[] {
  if (entityId === ALL) return LOCATIONS;
  const ids = resolveEntityIds(entityId);
  return LOCATIONS.filter((l) => ids.includes(l.entityId));
}

export function statesForEntity(entityId: string): string[] {
  const locs = locationsForEntity(entityId);
  return Array.from(new Set(locs.map((l) => l.state)));
}

export const ALL_STATES = Array.from(new Set(LOCATIONS.map((l) => l.state)));

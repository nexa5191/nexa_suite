import type { Entity, Location } from "./types";

// Multi-entity, multi-location, multi-state organisation tree.
// "Group" entities are those that have children (parentId set on children).
// resolveEntityIds() expands a group ID to include itself + all children,
// so any filter that calls it automatically handles rollup.

export const ENTITIES: Entity[] = [];

export const LOCATIONS: Location[] = [];

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

/**
 * Station settings read model - shape returned by GET /api/kds/stations.
 */

export type StationSettingsSubstation = {
  id: string;
  key: string;
  name: string;
  displayOrder: number;
};

export type StationSettingsStation = {
  id: string;
  key: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  substations: StationSettingsSubstation[];
};

export type StationSettingsView = {
  location: { id: string; name?: string };
  stations: StationSettingsStation[];
};

export function isStationSettingsView(v: unknown): v is StationSettingsView {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!o.location || typeof o.location !== "object") return false;
  const loc = o.location as Record<string, unknown>;
  if (typeof loc.id !== "string") return false;
  if (!Array.isArray(o.stations)) return false;
  return o.stations.every((s) => {
    if (!s || typeof s !== "object") return false;
    const t = s as Record<string, unknown>;
    const subs = t.substations;
    if (!Array.isArray(subs)) return false;
    const subsOk = subs.every((ss) => {
      if (!ss || typeof ss !== "object") return false;
      const u = ss as Record<string, unknown>;
      return (
        typeof u.id === "string" &&
        typeof u.key === "string" &&
        typeof u.name === "string" &&
        typeof u.displayOrder === "number"
      );
    });
    return (
      typeof t.id === "string" &&
      typeof t.key === "string" &&
      typeof t.name === "string" &&
      typeof t.displayOrder === "number" &&
      typeof t.isActive === "boolean" &&
      subsOk
    );
  });
}

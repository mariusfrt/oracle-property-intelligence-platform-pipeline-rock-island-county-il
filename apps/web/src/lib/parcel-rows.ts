/** Map a tRPC row record to UI table/map shape. */
export interface ParcelResultRow {
  objectid: number;
  pin?: string | null;
  site_address?: string | null;
  acreage?: number | null;
  zoning?: string | null;
  owner_name?: string | null;
  geom_geojson?: string | null;
  dist_to_power_m?: number | null;
}

export function mapParcelRow(record: Record<string, unknown>): ParcelResultRow {
  return {
    objectid: Number(record.objectid),
    pin: (record.pin as string | null | undefined) ?? null,
    site_address: (record.site_address as string | null | undefined) ?? null,
    acreage: record.acreage != null ? Number(record.acreage) : null,
    zoning: (record.zoning as string | null | undefined) ?? null,
    owner_name: (record.owner_name as string | null | undefined) ?? null,
    geom_geojson: (record.geom_geojson as string | null | undefined) ?? null,
    dist_to_power_m:
      record.dist_to_power_m != null ? Number(record.dist_to_power_m) : null,
  };
}

export function mapParcelRows(rows: Record<string, unknown>[]): ParcelResultRow[] {
  return rows.map(mapParcelRow);
}

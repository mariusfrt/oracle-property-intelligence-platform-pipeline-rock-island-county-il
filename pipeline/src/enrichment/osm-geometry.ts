import type { Geometry } from "../types.js";

export interface OsmLatLon {
  lat: number;
  lon: number;
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: OsmLatLon[];
}

export interface OsmResponse {
  elements: OsmElement[];
}

export function osmElementId(element: OsmElement): string {
  return `${element.type}/${element.id}`;
}

export function osmElementName(element: OsmElement): string | null {
  const tags = element.tags ?? {};
  return tags.name ?? tags.brand ?? null;
}

export function osmElementToGeometry(element: OsmElement): Geometry | null {
  if (element.type === "node" && element.lat != null && element.lon != null) {
    return { type: "Point", coordinates: [element.lon, element.lat] };
  }

  const points = element.geometry;
  if (!points || points.length === 0) return null;

  const coords = points.map((p) => [p.lon, p.lat]);
  if (coords.length === 1) {
    return { type: "Point", coordinates: coords[0] };
  }

  const first = coords[0];
  const last = coords[coords.length - 1];
  const isClosed =
    coords.length >= 4 &&
    first[0] === last[0] &&
    first[1] === last[1];

  if (isClosed) {
    return { type: "Polygon", coordinates: [coords] };
  }

  return { type: "LineString", coordinates: coords };
}

export function geomSqlExpression(geometry: Geometry | null): string {
  if (!geometry) return "NULL";
  const geomJson = JSON.stringify(geometry).replace(/'/g, "''");
  return `ST_GeomFromGeoJSON('${geomJson}')`;
}

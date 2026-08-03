"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** Rock Island County approximate center. */
const DEFAULT_CENTER: [number, number] = [-90.57, 41.48];

const FILL_LAYER = "parcels-fill";
const OUTLINE_LAYER = "parcels-outline";
const HIGHLIGHT_FILL = "parcels-highlight-fill";
const HIGHLIGHT_LAYER = "parcels-highlight";
const SOURCE_ID = "parcels";
const POINT_SOURCE = "parcel-points";
const POINT_LAYER = "parcels-points";

export interface MapParcelFeature {
  objectid: number;
  geom_geojson: string | null;
  label?: string;
}

interface ExplorerMapProps {
  parcels: MapParcelFeature[];
  selectedObjectId?: number | null;
  onSelect?: (objectid: number) => void;
  className?: string;
}

function extendBounds(bounds: maplibregl.LngLatBounds, coords: unknown): void {
  if (!Array.isArray(coords)) return;
  // Leaf position [lng, lat, ...]. Checking coords[0] avoids the previous bug where
  // a single-element array (e.g. a MultiPolygon with one polygon) was skipped.
  if (typeof coords[0] === "number") {
    if (coords.length >= 2) bounds.extend([coords[0] as number, coords[1] as number]);
    return;
  }
  for (const nested of coords) {
    extendBounds(bounds, nested);
  }
}

function boundsFromGeometry(geom: GeoJSON.Geometry): maplibregl.LngLatBounds | null {
  if (geom.type === "GeometryCollection") {
    const bounds = new maplibregl.LngLatBounds();
    for (const child of geom.geometries) {
      const childBounds = boundsFromGeometry(child);
      if (childBounds) bounds.extend(childBounds);
    }
    return bounds.isEmpty() ? null : bounds;
  }
  if (!("coordinates" in geom)) return null;
  const bounds = new maplibregl.LngLatBounds();
  extendBounds(bounds, geom.coordinates as unknown as number[]);
  return bounds.isEmpty() ? null : bounds;
}

export function ExplorerMap({
  parcels,
  selectedObjectId,
  onSelect,
  className = "",
}: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    // One-time readiness flag. isStyleLoaded() can report false after 'load'
    // (e.g. while raster tiles fetch), which would strand once('load') callbacks.
    map.on("load", () => {
      loadedRef.current = true;
    });

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const features: GeoJSON.Feature[] = [];
    const points: GeoJSON.Feature[] = [];
    for (const p of parcels) {
      if (!p.geom_geojson) continue;
      try {
        const geometry = JSON.parse(p.geom_geojson) as GeoJSON.Geometry;
        const props = { objectid: p.objectid, label: p.label ?? p.objectid };
        features.push({ type: "Feature", id: p.objectid, geometry, properties: props });
        // Centroid marker so parcels are visible even when small at a wide zoom.
        const b = boundsFromGeometry(geometry);
        if (b) {
          const c = b.getCenter();
          points.push({
            type: "Feature",
            id: p.objectid,
            geometry: { type: "Point", coordinates: [c.lng, c.lat] },
            properties: props,
          });
        }
      } catch {
        /* ignore parse errors */
      }
    }

    const polygonData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
    const pointData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: points };

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const raw = e.features?.[0]?.properties?.objectid;
      const id = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(id) && onSelectRef.current) onSelectRef.current(id);
    };

    const apply = () => {
      if (map.getSource(SOURCE_ID)) {
        (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(polygonData);
        (map.getSource(POINT_SOURCE) as maplibregl.GeoJSONSource)?.setData(pointData);
        return;
      }

      map.addSource(SOURCE_ID, { type: "geojson", data: polygonData });
      map.addSource(POINT_SOURCE, { type: "geojson", data: pointData });

      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#4f46e5", "fill-opacity": 0.45 },
      });
      map.addLayer({
        id: OUTLINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#4338ca", "line-width": 1.5, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: HIGHLIGHT_FILL,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#f59e0b", "fill-opacity": 0.45 },
        filter: ["==", ["get", "objectid"], -1],
      });
      map.addLayer({
        id: HIGHLIGHT_LAYER,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#f59e0b", "line-width": 4, "line-opacity": 1 },
        filter: ["==", ["get", "objectid"], -1],
      });
      // Marker dots keep parcels visible at any zoom; fade as you zoom into the polygons.
      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: POINT_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 6, 13, 5, 16, 3],
          "circle-color": "#4f46e5",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.9, 16, 0],
          "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 14, 1, 16, 0],
        },
      });

      map.on("click", FILL_LAYER, handleClick);
      map.on("click", POINT_LAYER, handleClick);
      for (const layer of [FILL_LAYER, POINT_LAYER]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    };

    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [parcels]);

  // Auto-fit the map to the current result set so new results (search or agent)
  // are always brought into view. `parcels` is memoized upstream, so this runs only
  // when the result set actually changes, not on every selection or render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const all = new maplibregl.LngLatBounds();
    let any = false;
    for (const p of parcels) {
      if (!p.geom_geojson) continue;
      try {
        const b = boundsFromGeometry(JSON.parse(p.geom_geojson) as GeoJSON.Geometry);
        if (b) {
          all.extend(b);
          any = true;
        }
      } catch {
        /* ignore parse errors */
      }
    }
    if (!any) return;

    const fit = () => {
      map.resize();
      map.fitBounds(all, { padding: 64, maxZoom: 11, duration: 700 });
    };
    if (loadedRef.current) fit();
    else map.once("load", fit);
  }, [parcels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateHighlight = () => {
      if (!map.getLayer(HIGHLIGHT_LAYER)) return;
      const filter: maplibregl.FilterSpecification = [
        "==",
        ["get", "objectid"],
        selectedObjectId ?? -1,
      ];
      map.setFilter(HIGHLIGHT_LAYER, filter);
      map.setFilter(HIGHLIGHT_FILL, filter);
    };

    if (loadedRef.current) updateHighlight();
    else map.once("load", updateHighlight);

    if (selectedObjectId == null) return;
    const feature = parcels.find((p) => p.objectid === selectedObjectId);
    if (!feature?.geom_geojson) return;

    try {
      const geom = JSON.parse(feature.geom_geojson) as GeoJSON.Geometry;
      if (geom.type === "Point") {
        map.flyTo({
          center: geom.coordinates as [number, number],
          zoom: 13,
          duration: 800,
        });
        return;
      }
      const bounds = boundsFromGeometry(geom);
      if (bounds) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 800 });
      }
    } catch {
      /* ignore parse errors */
    }
  }, [selectedObjectId, parcels]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full rounded-xl ${className}`}
      aria-label="Parcel map"
    />
  );
}

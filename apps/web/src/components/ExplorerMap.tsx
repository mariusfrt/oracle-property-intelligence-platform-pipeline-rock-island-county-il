"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** Rock Island County approximate center. */
const DEFAULT_CENTER: [number, number] = [-90.57, 41.48];

export interface MapParcelFeature {
  objectid: number;
  geom_geojson: string | null;
  label?: string;
}

interface ExplorerMapProps {
  parcels: MapParcelFeature[];
  selectedObjectId?: number | null;
  onSelect?: (objectid: number) => void;
}

export function ExplorerMap({ parcels, selectedObjectId, onSelect }: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "parcels";
    const layerId = "parcels-fill";

    const features = parcels
      .filter((p) => p.geom_geojson)
      .map((p) => {
        try {
          return {
            type: "Feature" as const,
            id: p.objectid,
            geometry: JSON.parse(p.geom_geojson!) as GeoJSON.Geometry,
            properties: { objectid: p.objectid, label: p.label ?? p.objectid },
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: features as GeoJSON.Feature[],
    };

    const apply = () => {
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource(sourceId, { type: "geojson", data: geojson });
        map.addLayer({
          id: layerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "#2563eb",
            "fill-opacity": 0.35,
            "fill-outline-color": "#1d4ed8",
          },
        });
        map.on("click", layerId, (e) => {
          const id = e.features?.[0]?.properties?.objectid;
          if (typeof id === "number" && onSelect) onSelect(id);
        });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [parcels, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedObjectId == null) return;
    const feature = parcels.find((p) => p.objectid === selectedObjectId);
    if (!feature?.geom_geojson) return;
    try {
      const geom = JSON.parse(feature.geom_geojson) as GeoJSON.Geometry;
      if (geom.type === "Point") {
        map.flyTo({ center: geom.coordinates as [number, number], zoom: 14 });
      }
    } catch {
      /* ignore parse errors */
    }
  }, [selectedObjectId, parcels]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: 420, borderRadius: 8 }}
      aria-label="Parcel map"
    />
  );
}

"use client";

import { useState } from "react";
import type { SearchParcelsFilters, PresetQueryKind } from "@oracle/shared";
import { ExplorerMap } from "@/components/ExplorerMap";
import { FilterPanel } from "@/components/FilterPanel";
import { ParcelDrawer } from "@/components/ParcelDrawer";
import { ResultsTable } from "@/components/ResultsTable";

/** Explorer — MapLibre + table + filters + detail drawer. */
export default function ExplorerPage() {
  const [filters, setFilters] = useState<SearchParcelsFilters>({});
  const [rows, setRows] = useState<
    Array<{
      objectid: number;
      pin?: string | null;
      site_address?: string | null;
      acreage?: number | null;
      zoning?: string | null;
      owner_name?: string | null;
      geom_geojson?: string | null;
    }>
  >([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleSearch() {
    // TODO: trpc.parcels.searchParcels.query({ ...filters, page: 1 })
    void filters;
    setRows([]);
  }

  function handlePreset(preset: PresetQueryKind) {
    // TODO: trpc.parcels.presetQuery.query({ preset, page: 1 })
    void preset;
    setRows([]);
  }

  const selected = rows.find((r) => r.objectid === selectedId) ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        onPreset={handlePreset}
      />
      <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12, minHeight: 640 }}>
        <ExplorerMap
          parcels={rows.map((r) => ({
            objectid: r.objectid,
            geom_geojson: r.geom_geojson ?? null,
            label: r.pin ?? String(r.objectid),
          }))}
          selectedObjectId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setDrawerOpen(true);
          }}
        />
        <ResultsTable
          rows={rows}
          selectedObjectId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setDrawerOpen(true);
          }}
        />
      </div>
      <ParcelDrawer
        open={drawerOpen}
        parcel={selected}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

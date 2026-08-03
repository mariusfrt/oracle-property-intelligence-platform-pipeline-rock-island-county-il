"use client";

import { useState } from "react";
import { ExplorerMap } from "@/components/ExplorerMap";
import { ResultsTable } from "@/components/ResultsTable";

/** Data-center candidates — ranked list + map with live sliders. */
export default function DataCenterPage() {
  const [minAcres, setMinAcres] = useState(20);
  const [powerRadiusM, setPowerRadiusM] = useState(1609);
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

  function handleRefresh() {
    // TODO: trpc.parcels.dataCenterCandidates.query({ minAcres, powerRadiusM, page: 1 })
    void minAcres;
    void powerRadiusM;
    setRows([]);
  }

  return (
    <div>
      <h1>Data-center candidates</h1>
      <p>
        Large + industrial + stable ownership + near power. Thresholds are configurable
        (README &quot;configurable acreage threshold&quot;) — baked <code>dc_candidate</code> is
        ignored; computed live from signals.
      </p>

      <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
        <label>
          Min acres: {minAcres}
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={minAcres}
            onChange={(e) => setMinAcres(Number(e.target.value))}
          />
        </label>
        <label>
          Power radius (m): {powerRadiusM}
          <input
            type="range"
            min={500}
            max={5000}
            step={100}
            value={powerRadiusM}
            onChange={(e) => setPowerRadiusM(Number(e.target.value))}
          />
        </label>
        <button type="button" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateRows: "420px auto", gap: 12 }}>
        <ExplorerMap
          parcels={rows.map((r) => ({
            objectid: r.objectid,
            geom_geojson: r.geom_geojson ?? null,
          }))}
        />
        <ResultsTable rows={rows} />
      </div>
    </div>
  );
}

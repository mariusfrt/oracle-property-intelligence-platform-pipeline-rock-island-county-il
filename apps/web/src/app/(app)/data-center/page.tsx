"use client";

import { useState } from "react";
import { ExplorerMap } from "@/components/ExplorerMap";
import { ResultsTable } from "@/components/ResultsTable";
import { ViewToggle } from "@/components/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { mapParcelRows } from "@/lib/parcel-rows";
import { trpc } from "@/lib/trpc-react";

const PAGE_SIZE = 50;

const SLIDER_FILL = "rgb(79 70 229)"; // indigo-600
const SLIDER_TRACK = "rgb(226 232 240)"; // slate-200

type MobileView = "list" | "map";

/** Paints the range track indigo up to the thumb (native fill is removed by appearance-none). */
function sliderFill(value: number, min: number, max: number): { backgroundImage: string } {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return {
    backgroundImage: `linear-gradient(to right, ${SLIDER_FILL} 0%, ${SLIDER_FILL} ${pct}%, ${SLIDER_TRACK} ${pct}%, ${SLIDER_TRACK} 100%)`,
  };
}

/** Data-center candidates, ranked list + map with live sliders. */
export default function DataCenterPage() {
  const [minAcres, setMinAcres] = useState(20);
  const [powerRadiusM, setPowerRadiusM] = useState(1609);
  const [page, setPage] = useState(1);
  const [enabled, setEnabled] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");

  const candidatesQuery = trpc.parcels.dataCenterCandidates.useQuery(
    { minAcres, powerRadiusM, page, pageSize: PAGE_SIZE },
    { enabled },
  );

  const rows = mapParcelRows((candidatesQuery.data?.rows ?? []) as Record<string, unknown>[]);
  const total = candidatesQuery.data?.total ?? 0;

  function handleRefresh() {
    setPage(1);
    setEnabled(true);
    void candidatesQuery.refetch();
  }

  const emptyMessage = !enabled
    ? "Adjust sliders and click Refresh to load candidates."
    : candidatesQuery.isError
      ? "Unable to load candidates right now. Please try again."
      : "No parcels match the current acreage and power-radius thresholds.";

  const mapParcels = rows.map((r) => ({
    objectid: r.objectid,
    geom_geojson: r.geom_geojson ?? null,
    label: r.pin ?? String(r.objectid),
  }));

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-6">
      {/* Control bar, full width, wraps on narrow screens */}
      <div className="card mb-3 flex shrink-0 flex-wrap items-end gap-4 p-4 sm:gap-6">
        <div className="min-w-[10rem] flex-1 basis-[12rem]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="min-acres-slider" className="label-caps">
              Min acreage
            </label>
            <Badge variant="accent">{minAcres} ac</Badge>
          </div>
          <input
            id="min-acres-slider"
            type="range"
            min={5}
            max={100}
            step={1}
            value={minAcres}
            onChange={(e) => setMinAcres(Number(e.target.value))}
            style={sliderFill(minAcres, 5, 100)}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600 focus-ring"
          />
        </div>

        <div className="min-w-[10rem] flex-1 basis-[12rem]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="power-radius-slider" className="label-caps">
              Power radius
            </label>
            <Badge variant="accent">{powerRadiusM.toLocaleString()} m</Badge>
          </div>
          <input
            id="power-radius-slider"
            type="range"
            min={500}
            max={5000}
            step={100}
            value={powerRadiusM}
            onChange={(e) => setPowerRadiusM(Number(e.target.value))}
            style={sliderFill(powerRadiusM, 500, 5000)}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600 focus-ring"
          />
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <ViewToggle
            value={mobileView}
            onChange={setMobileView}
            className="lg:hidden"
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={candidatesQuery.isFetching}
            className="btn-primary shrink-0"
          >
            {candidatesQuery.isFetching ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Desktop: Results | Map, Mobile: stacked panes with List/Map toggle */}
      <div className="relative min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:gap-3">
        <div
          className={`absolute inset-0 min-h-0 min-w-0 ${
            mobileView === "list" ? "z-10" : "invisible pointer-events-none z-0"
          } lg:static lg:visible lg:pointer-events-auto lg:z-auto lg:flex lg:flex-col`}
        >
          <ResultsTable
            rows={rows}
            showDistToPower
            showRank
            loading={enabled && candidatesQuery.isFetching}
            isError={enabled && candidatesQuery.isError}
            emptyMessage={emptyMessage}
            total={enabled ? total : undefined}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            className="h-full"
          />
        </div>

        <div
          className={`absolute inset-0 min-h-0 min-w-0 ${
            mobileView === "map" ? "z-10" : "invisible pointer-events-none z-0"
          } lg:static lg:visible lg:pointer-events-auto lg:z-auto lg:flex lg:flex-col`}
        >
          <div className="card h-full min-h-0 overflow-hidden p-1.5">
            <ExplorerMap parcels={mapParcels} className="border-0 shadow-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { ExplorerMap } from "@/components/ExplorerMap";
import { ParcelDrawer, type ParcelDetail } from "@/components/ParcelDrawer";
import { ResultsTable } from "@/components/ResultsTable";
import { ViewToggle } from "@/components/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { mapParcelRows } from "@/lib/parcel-rows";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
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

/** Data-center candidates: a ranked, threshold-tuned finder over the shared query layer. */
export default function DataCenterPage() {
  const [minAcres, setMinAcres] = useState(20);
  const [powerRadiusM, setPowerRadiusM] = useState(1609);
  const [page, setPage] = useState(1);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Loads on mount with the default thresholds. Debounced so dragging a slider
  // does not fire a request on every step; the query re-runs once you settle.
  const queryInput = useMemo(
    () => ({ minAcres, powerRadiusM, page, pageSize: PAGE_SIZE }),
    [minAcres, powerRadiusM, page],
  );
  const debouncedInput = useDebouncedValue(queryInput, 350);
  const candidatesQuery = trpc.parcels.dataCenterCandidates.useQuery(debouncedInput, {
    enabled: true,
  });

  const rows = useMemo(
    () => mapParcelRows((candidatesQuery.data?.rows ?? []) as Record<string, unknown>[]),
    [candidatesQuery.data],
  );
  const total = candidatesQuery.data?.total ?? 0;

  const parcelDetailQuery = trpc.parcels.parcel.useQuery(
    { objectid: selectedId ?? 0 },
    { enabled: drawerOpen && selectedId != null },
  );
  const parcelDetail: ParcelDetail | null = parcelDetailQuery.data?.parcel
    ? (parcelDetailQuery.data.parcel as ParcelDetail)
    : null;

  const handleSelect = useCallback((objectid: number) => {
    setSelectedId(objectid);
    setDrawerOpen(true);
  }, []);

  const emptyMessage = candidatesQuery.isError
    ? "Unable to load candidates right now. Please try again."
    : "No parcels match the current acreage and power-radius thresholds.";

  const mapParcels = useMemo(
    () =>
      rows.map((r) => ({
        objectid: r.objectid,
        geom_geojson: r.geom_geojson ?? null,
        label: r.pin ?? String(r.objectid),
      })),
    [rows],
  );

  const criteria = [
    `Above ${minAcres} acres`,
    "Industrial zoning",
    "Stable ownership",
    `Within ${powerRadiusM.toLocaleString()} m of power`,
  ];

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-6">
      {/* Control bar */}
      <div className="card mb-3 flex shrink-0 flex-wrap items-end gap-4 p-4 sm:gap-6">
        {/* Identity: this is the ranked, opinionated candidate finder */}
        <div className="w-full">
          <h1 className="text-base font-semibold text-slate-900">Data-center candidates</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Parcels ranked by distance to power, matching a fixed suitability profile. Tune the
            acreage threshold and power radius to refine the ranking.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {criteria.map((c) => (
              <span
                key={c}
                className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

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
            onChange={(e) => {
              setMinAcres(Number(e.target.value));
              setPage(1);
            }}
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
            onChange={(e) => {
              setPowerRadiusM(Number(e.target.value));
              setPage(1);
            }}
            style={sliderFill(powerRadiusM, 500, 5000)}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600 focus-ring"
          />
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <ViewToggle value={mobileView} onChange={setMobileView} className="lg:hidden" />
          {candidatesQuery.isFetching ? (
            <span className="text-xs text-slate-500">Updating…</span>
          ) : null}
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
            selectedObjectId={selectedId}
            onSelect={handleSelect}
            showDistToPower
            showRank
            loading={candidatesQuery.isFetching}
            isError={candidatesQuery.isError}
            emptyMessage={emptyMessage}
            total={total}
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
            <ExplorerMap
              parcels={mapParcels}
              selectedObjectId={selectedId}
              onSelect={handleSelect}
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>

      <ParcelDrawer
        open={drawerOpen}
        parcel={parcelDetail}
        loading={parcelDetailQuery.isFetching}
        error={parcelDetailQuery.isError}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedId(null);
        }}
      />
    </div>
  );
}

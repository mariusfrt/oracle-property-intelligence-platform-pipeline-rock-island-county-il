"use client";

import type { ReactNode } from "react";
import {
  Building2,
  Bus,
  Coffee,
  Database,
  Droplets,
  ExternalLink,
  Hash,
  MapPin,
  Ruler,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

export interface ParcelDetail {
  objectid: number;
  pin?: string | null;
  site_address?: string | null;
  acreage?: number | null;
  zoning?: string | null;
  owner_name?: string | null;
  owner_state?: string | null;
  dist_transmission_m?: number | null;
  dist_substation_m?: number | null;
  dist_transit_m?: number | null;
  dist_starbucks_m?: number | null;
  dist_water_m?: number | null;
  source_system?: string | null;
  source_url?: string | null;
  retrieved_at?: string | null;
  [key: string]: unknown;
}

interface ParcelDrawerProps {
  parcel: ParcelDetail | null;
  open: boolean;
  loading?: boolean;
  error?: boolean;
  onClose: () => void;
}

/** ~1 mile power radius, ~0.5 mile walkshed, ~300m water proximity. */
const NEAR_M = {
  power: 1609,
  transit: 800,
  starbucks: 800,
  water: 300,
} as const;

const EMPTY = <span className="text-slate-400">Not recorded</span>;

export function ParcelDrawer({ parcel, open, loading, error, onClose }: ParcelDrawerProps) {
  if (!open) return null;

  const ownerName = parcel?.owner_name?.trim() || null;
  const title = ownerName ?? parcel?.pin ?? (parcel ? `Parcel ${parcel.objectid}` : "Loading…");

  return (
    <>
      <button
        type="button"
        aria-label="Close parcel detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-slate-50 shadow-2xl"
        aria-labelledby="parcel-drawer-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="label-caps text-indigo-600">Parcel detail</p>
            <h2
              id="parcel-drawer-title"
              className="mt-0.5 truncate text-lg font-semibold text-slate-900"
              title={typeof title === "string" ? title : undefined}
            >
              {title}
            </h2>
            {parcel?.site_address ? (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                {parcel.site_address}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="btn-secondary shrink-0 text-xs">
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <DrawerSkeleton />
          ) : error ? (
            <ErrorState message="Unable to load parcel detail right now. Please try again." />
          ) : !parcel ? (
            <p className="text-sm text-slate-500">No parcel selected.</p>
          ) : (
            <div className="space-y-3">
              <Section title="Ownership" icon={Building2} accent="indigo">
                <Field label="Owner" value={parcel.owner_name} strong />
                {parcel.owner_state ? (
                  <Field label="Owner state" value={parcel.owner_state} />
                ) : null}
              </Section>

              <Section title="Valuation" icon={Ruler} accent="emerald">
                {parcel.acreage != null ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tabular-nums text-slate-900">
                      {parcel.acreage.toFixed(2)}
                    </span>
                    <span className="text-sm text-slate-500">acres</span>
                  </div>
                ) : (
                  <p className="text-sm">{EMPTY}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">Parcel size from county GIS geometry.</p>
              </Section>

              <Section title="Distances" icon={Zap} accent="amber">
                <div className="space-y-1.5">
                  <DistanceRow label="Transmission" icon={Zap} meters={parcel.dist_transmission_m} near={NEAR_M.power} />
                  <DistanceRow label="Substation" icon={Zap} meters={parcel.dist_substation_m} near={NEAR_M.power} />
                  <DistanceRow label="Transit" icon={Bus} meters={parcel.dist_transit_m} near={NEAR_M.transit} />
                  <DistanceRow label="Starbucks" icon={Coffee} meters={parcel.dist_starbucks_m} near={NEAR_M.starbucks} />
                  <DistanceRow label="Water" icon={Droplets} meters={parcel.dist_water_m} near={NEAR_M.water} />
                </div>
              </Section>

              <Section title="Provenance" icon={Database} accent="sky">
                <Field label="Source system" value={parcel.source_system} />
                <Field label="Retrieved" value={parcel.retrieved_at} tabular />
                {parcel.source_url ? (
                  <a
                    href={parcel.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-indigo-600 hover:text-indigo-700 focus-ring"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Open source record
                  </a>
                ) : null}
              </Section>

              <Section title="Identity" icon={Hash} accent="slate">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Object ID" value={String(parcel.objectid)} tabular />
                  <Field label="PIN" value={parcel.pin} tabular />
                </div>
                <Field label="Address" value={parcel.site_address} />
                <div>
                  <dt className="label-caps">Zoning</dt>
                  <dd className="mt-1">
                    {parcel.zoning ? <Badge variant="muted">{parcel.zoning}</Badge> : EMPTY}
                  </dd>
                </div>
              </Section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

type Accent = "indigo" | "emerald" | "amber" | "sky" | "slate";

const ACCENT_ICON: Record<Accent, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  slate: "bg-slate-100 text-slate-600",
};

function Section({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: typeof Building2;
  accent: Accent;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${ACCENT_ICON[accent]}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </h3>
      <dl className="space-y-2.5">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  tabular,
  strong,
}: {
  label: string;
  value: string | null | undefined;
  tabular?: boolean;
  strong?: boolean;
}) {
  const has = value != null && String(value).trim().length > 0;
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd
        className={`mt-0.5 text-sm ${strong ? "font-semibold text-slate-900" : "text-slate-800"} ${
          tabular ? "tabular-nums" : ""
        }`}
      >
        {has ? value : EMPTY}
      </dd>
    </div>
  );
}

function DistanceRow({
  label,
  icon: Icon,
  meters,
  near,
}: {
  label: string;
  icon: typeof Zap;
  meters: unknown;
  near: number;
}) {
  const n = meters == null ? null : Number(meters);
  const valid = n != null && Number.isFinite(n) && n < 1e17;
  const isNear = valid && n <= near;

  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-sm text-slate-600">
        <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        {label}
      </dt>
      <dd
        className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
          isNear
            ? "bg-emerald-50 text-emerald-700"
            : valid
              ? "bg-slate-100 text-slate-600"
              : "text-slate-400"
        }`}
      >
        {valid ? `${Math.round(n).toLocaleString()} m` : "Not recorded"}
      </dd>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

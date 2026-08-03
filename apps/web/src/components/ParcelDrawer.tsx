"use client";

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

export function ParcelDrawer({ parcel, open, loading, error, onClose }: ParcelDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close parcel detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
        aria-labelledby="parcel-drawer-title"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="label-caps">Parcel detail</p>
            <h2 id="parcel-drawer-title" className="text-lg font-semibold text-slate-900">
              {parcel?.pin ?? parcel?.objectid ?? "Loading…"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <DrawerSkeleton />
          ) : error ? (
            <ErrorState message="Unable to load parcel detail right now. Please try again." />
          ) : !parcel ? (
            <p className="text-sm text-slate-500">No parcel selected.</p>
          ) : (
            <div className="space-y-6">
              <Section title="Identity">
                <Field label="Object ID" value={String(parcel.objectid)} />
                <Field label="PIN" value={parcel.pin} />
                <Field label="Address" value={parcel.site_address} />
                {parcel.zoning ? (
                  <div>
                    <dt className="label-caps">Zoning</dt>
                    <dd className="mt-1">
                      <Badge variant="muted">{parcel.zoning}</Badge>
                    </dd>
                  </div>
                ) : null}
              </Section>

              <Section title="Valuation">
                <Field
                  label="Acreage"
                  value={parcel.acreage != null ? `${parcel.acreage.toFixed(2)} ac` : null}
                  tabular
                />
              </Section>

              <Section title="Ownership">
                <Field label="Owner" value={parcel.owner_name} />
              </Section>

              <Section title="Distances">
                <DistanceRow label="Transmission" meters={parcel.dist_transmission_m} />
                <DistanceRow label="Substation" meters={parcel.dist_substation_m} />
                <DistanceRow label="Transit" meters={parcel.dist_transit_m} />
                <DistanceRow label="Starbucks" meters={parcel.dist_starbucks_m} />
                <DistanceRow label="Water" meters={parcel.dist_water_m} />
              </Section>

              <Section title="Provenance">
                <Field label="Source system" value={parcel.source_system} />
                <Field label="Retrieved" value={parcel.retrieved_at} />
                {parcel.source_url ? (
                  <div>
                    <dt className="label-caps">Source link</dt>
                    <dd className="mt-1">
                      <a
                        href={parcel.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-700 focus-ring rounded"
                      >
                        Open source URL
                      </a>
                    </dd>
                  </div>
                ) : null}
              </Section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="label-caps mb-3 border-b border-slate-100 pb-2">{title}</h3>
      <dl className="space-y-3">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null | undefined;
  tabular?: boolean;
}) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-800 ${tabular ? "tabular-nums" : ""}`}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

function DistanceRow({ label, meters }: { label: string; meters: unknown }) {
  const formatted = formatDistance(meters);
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd>
        <Badge variant="default">{formatted}</Badge>
      </dd>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function formatDistance(value: unknown): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString()} m`;
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  Coffee,
  Droplets,
  MapPinned,
  TrainFront,
  UtilityPole,
  Zap,
} from "lucide-react";
import type { ArtifactsResponse, LayerCount, SummaryResponse } from "@oracle/shared";
import { IpfsArtifactsSection } from "@/components/IpfsArtifactsSection";
import { ErrorState } from "@/components/ui/ErrorState";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Skeleton, StatCardSkeleton } from "@/components/ui/Skeleton";

interface RunSummaryProps {
  summary: SummaryResponse | null;
  artifacts?: ArtifactsResponse | null;
  loading?: boolean;
}

type EnrichmentKey = Exclude<keyof SummaryResponse["layers"], "parcels">;

const ENRICHMENT_LAYERS: {
  key: EnrichmentKey;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
}[] = [
  {
    key: "transmission",
    label: "Transmission",
    description: "Power transmission lines",
    icon: Zap,
    accent: "border-amber-200/80",
    iconBg: "bg-amber-50 text-amber-700",
  },
  {
    key: "substations",
    label: "Substations",
    description: "Electrical substations",
    icon: UtilityPole,
    accent: "border-amber-200/80",
    iconBg: "bg-amber-50 text-amber-700",
  },
  {
    key: "transit",
    label: "Transit",
    description: "Bus and rail stops",
    icon: TrainFront,
    accent: "border-emerald-200/80",
    iconBg: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "starbucks",
    label: "Starbucks",
    description: "Starbucks locations",
    icon: Coffee,
    accent: "border-emerald-200/80",
    iconBg: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "water",
    label: "Water",
    description: "Rivers and water bodies",
    icon: Droplets,
    accent: "border-sky-200/80",
    iconBg: "bg-sky-50 text-sky-700",
  },
];

function formatRetrieved(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function RunSummary({ summary, artifacts = null, loading }: RunSummaryProps) {
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-6 w-72" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-6">
        <HeroHeader />
        <ErrorState
          title="Summary unavailable"
          message="Live counts are temporarily unavailable. Please refresh to try again."
        />
        <QuickLinks />
      </div>
    );
  }

  const parcels = summary.layers.parcels;
  const retrieved = formatRetrieved(parcels.retrievedAt);

  return (
    <div className="space-y-10">
      <HeroHeader />

      {/* Hero parcel metric: compact single row */}
      <section className="card relative overflow-visible border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50/60 p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Building2 className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="label-caps flex items-center gap-1.5 text-indigo-600">
              County coverage · parcels ingested
              <InfoTooltip text="These figures are read live from cloud storage each time the page loads. There is no always-on database to run or maintain." />
            </p>
            <p className="text-4xl font-semibold leading-none tracking-tight text-slate-900 tabular-nums sm:text-5xl">
              {parcels.count.toLocaleString()}
            </p>
          </div>
          {retrieved ? (
            <p className="ml-auto text-sm text-slate-500">
              Retrieved <span className="tabular-nums text-slate-700">{retrieved}</span>
            </p>
          ) : null}
        </div>
      </section>

      {/* Enrichment layers */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Enrichment layers</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Power, transit, and amenity proximity signals joined to every parcel
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ENRICHMENT_LAYERS.map(({ key, label, description, icon: Icon, accent, iconBg }) => (
            <EnrichmentCard
              key={key}
              label={label}
              description={description}
              layer={summary.layers[key]}
              icon={Icon}
              accent={accent}
              iconBg={iconBg}
            />
          ))}
        </div>
      </section>

      <QuickLinks />

      <IpfsArtifactsSection artifacts={artifacts} />

      {/* Provenance */}
      <section className="card overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Data sources & provenance</h2>
          <p className="mt-0.5 text-xs text-slate-500">Layer counts and retrieval timestamps</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="label-caps px-5 py-3 font-medium">Source</th>
                <th className="label-caps px-5 py-3 font-medium text-right">Records</th>
                <th className="label-caps px-5 py-3 font-medium">Retrieved</th>
                <th className="label-caps px-5 py-3 font-medium">URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(summary.layers).map(([name, layer]) => (
                <tr key={name} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3 font-medium capitalize text-slate-800">{name}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-800">
                    {layer.count.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {formatRetrieved(layer.retrievedAt) ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {layer.sourceUrl ? (
                      <a
                        href={layer.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded text-indigo-600 hover:text-indigo-700 focus-ring"
                      >
                        View source
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {summary.limitations.length > 0 ? (
        <aside className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-5 py-4">
          <h2 className="label-caps text-amber-800">Known limitations</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900/90">
            {summary.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

function HeroHeader() {
  return (
    <header className="space-y-3">
      <p className="label-caps">Run summary</p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Rock Island County Property Intelligence
      </h1>
      <p className="text-base text-slate-600 sm:text-lg">
        Full-county parcel ingest plus power and POI enrichment for data-center site selection.
      </p>
    </header>
  );
}

function EnrichmentCard({
  label,
  description,
  layer,
  icon: Icon,
  accent,
  iconBg,
}: {
  label: string;
  description: string;
  layer: LayerCount;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
}) {
  return (
    <div className={`card flex items-center gap-4 border ${accent} p-4`}>
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="label-caps">{label}</p>
        <p className="text-2xl font-semibold leading-tight tabular-nums tracking-tight text-slate-900">
          {layer.count.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function QuickLinks() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Quick links</h2>
        <p className="mt-0.5 text-xs text-slate-500">Interactive tools for parcel and site analysis</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          href="/explorer"
          icon={MapPinned}
          title="Explore & filter parcels"
          description="Search by acreage, zoning, ownership, and proximity, then inspect parcels on the map."
        />
        <ActionCard
          href="/data-center"
          icon={Zap}
          title="Find data-center sites"
          description="Rank large industrial parcels near power with live acreage and radius thresholds."
        />
      </div>
    </section>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex items-start gap-4 border-slate-200 p-5 transition hover:border-indigo-200 hover:shadow-md focus-ring"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600"
            aria-hidden
          />
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

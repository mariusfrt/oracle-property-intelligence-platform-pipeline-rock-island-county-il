interface StatCardProps {
  label: string;
  value: number | string;
  source?: string | null;
}

export function StatCard({ label, value, source }: StatCardProps) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="label-caps">{label}</p>
      <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {source ? <p className="text-xs text-slate-500">{source}</p> : null}
    </div>
  );
}

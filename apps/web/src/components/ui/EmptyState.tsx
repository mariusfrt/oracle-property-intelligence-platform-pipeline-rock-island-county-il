interface EmptyStateProps {
  title?: string;
  message: string;
}

export function EmptyState({ title = "No results", message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}

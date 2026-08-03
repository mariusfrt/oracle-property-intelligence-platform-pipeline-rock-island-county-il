"use client";

type WorkspaceView = "list" | "map";

interface ViewToggleProps {
  value: WorkspaceView;
  onChange: (value: WorkspaceView) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className = "" }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Workspace view"
      className={`inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 ${className}`}
    >
      {(["list", "map"] as const).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={`min-w-[4.5rem] rounded-md px-3 py-1.5 text-sm font-medium capitalize transition focus-ring ${
              active
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

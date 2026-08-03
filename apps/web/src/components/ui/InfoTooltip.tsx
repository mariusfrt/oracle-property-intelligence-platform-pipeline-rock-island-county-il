"use client";

import { Info } from "lucide-react";

interface InfoTooltipProps {
  text: string;
  label?: string;
}

/** Small info icon that reveals a short explanation on hover or keyboard focus. */
export function InfoTooltip({ text, label = "More information" }: InfoTooltipProps) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="focus-ring rounded-full text-slate-400 transition hover:text-slate-600"
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

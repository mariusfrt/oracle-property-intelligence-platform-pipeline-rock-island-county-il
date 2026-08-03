"use client";

import { useState } from "react";
import type { SearchParcelsFilters } from "@oracle/shared";
import { Loader2, Send, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc-react";

export interface AgentPanelProps {
  filters: SearchParcelsFilters;
  onResult: (
    parcels: Record<string, unknown>[],
    question: string,
    matchedTotal: number,
  ) => void;
  className?: string;
}

export function AgentPanel({ filters, onResult, className = "" }: AgentPanelProps) {
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ask = trpc.agent.ask.useMutation();

  async function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;

    setDraft("");
    setError(null);
    setAnswer(null);

    try {
      const result = await ask.mutateAsync({ question: trimmed, filters });
      setAnswer(result.answer);
      const parcels = (result.parcels ?? []) as Record<string, unknown>[];
      onResult(parcels, trimmed, result.matchedTotal ?? parcels.length);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "The agent could not answer. Check that the API is running and Bedrock is reachable.";
      setError(message);
    }
  }

  return (
    <aside className={`card flex min-h-0 flex-col overflow-hidden p-0 ${className}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Agent</h2>
          <p className="mt-0.5 text-xs text-slate-500">Ask in natural language</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(draft);
          }}
        >
          <label htmlFor="explorer-agent-question" className="sr-only">
            Ask the property intelligence agent
          </label>
          <textarea
            id="explorer-agent-question"
            rows={3}
            value={draft}
            disabled={ask.isPending}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about parcels, ownership, or data-center suitability…"
            className="input-base resize-none text-sm"
          />
          <button
            type="submit"
            disabled={ask.isPending || !draft.trim()}
            className="btn-primary w-full gap-2 text-sm"
          >
            {ask.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {ask.isPending ? "Asking…" : "Send"}
          </button>
        </form>

        {error ? (
          <p className="rounded-md border border-red-100 bg-red-50 px-2.5 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        {answer ? (
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2">
            <p className="label-caps mb-1.5">Answer</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{answer}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

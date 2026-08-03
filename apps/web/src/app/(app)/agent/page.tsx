"use client";

import { useState } from "react";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { trpc } from "@/lib/trpc-react";

const EXAMPLE_QUESTIONS = [
  "Which larger parcels in Rock Island County have stable ownership (no recorded transfer in the last 10+ years) and any available signals related to power or industrial suitability?",
  "Which properties appear to be strong candidates for further data-center review based on size, ownership age, and location/power signals?",
] as const;

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  sources?: Array<{
    pin: string | null;
    site_address: string | null;
    owner_name: string | null;
    source_url: string | null;
    retrieved_at: string | null;
  }>;
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const ask = trpc.agent.ask.useMutation();

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;

    const userMessage: ChatMessage = {
      id: nextId(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");

    try {
      const result = await ask.mutateAsync({ question: trimmed });
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "agent",
          content: result.answer,
          sources: result.sources,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The agent could not answer this question. Check that the API is running and Bedrock is reachable.";
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "agent",
          content: `Sorry, something went wrong: ${message}`,
          sources: [],
        },
      ]);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <p className="label-caps">Conversational agent</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Property Intelligence Agent
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Ask about Rock Island County parcels, ownership stability, industrial signals, and
          data-center suitability. Answers use live DuckDB queries and cite source evidence.
        </p>
      </header>

      <section className="card space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden />
          Example questions
        </div>
        <div className="flex flex-col gap-2">
          {EXAMPLE_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              disabled={ask.isPending}
              onClick={() => void submitQuestion(question)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-slate-900 disabled:opacity-50 focus-ring"
            >
              {question}
            </button>
          ))}
        </div>
      </section>

      <section className="card flex min-h-[28rem] flex-col overflow-hidden p-0">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 text-center">
              <Bot className="h-8 w-8 text-slate-300" aria-hidden />
              <p className="text-sm font-medium text-slate-600">No messages yet</p>
              <p className="max-w-sm text-xs text-slate-500">
                Choose an example above or type a question about Rock Island parcels.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "agent" ? (
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <Bot className="h-4 w-4" aria-hidden />
                  </span>
                ) : null}
                <div
                  className={`max-w-[85%] space-y-3 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 bg-white text-slate-800 shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === "agent" && message.sources && message.sources.length > 0 ? (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="label-caps mb-2">Evidence</p>
                      <ul className="space-y-2">
                        {message.sources.map((source, index) => {
                          const label =
                            source.owner_name ||
                            source.site_address ||
                            source.pin ||
                            `Source ${index + 1}`;
                          return (
                            <li
                              key={`${source.pin ?? ""}-${source.source_url ?? ""}-${index}`}
                              className="text-xs text-slate-600"
                            >
                              {source.source_url ? (
                                <a
                                  href={source.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-indigo-600 hover:text-indigo-700 focus-ring rounded"
                                >
                                  {label}
                                </a>
                              ) : (
                                <span className="font-medium text-slate-800">{label}</span>
                              )}
                              {source.site_address && source.owner_name ? (
                                <span className="text-slate-500"> · {source.site_address}</span>
                              ) : null}
                              {source.retrieved_at ? (
                                <span className="block tabular-nums text-slate-400">
                                  Retrieved {source.retrieved_at}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
                {message.role === "user" ? (
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <User className="h-4 w-4" aria-hidden />
                  </span>
                ) : null}
              </article>
            ))
          )}

          {ask.isPending ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden />
              Querying parcels and drafting an answer…
            </div>
          ) : null}
        </div>

        <form
          className="border-t border-slate-200 bg-slate-50/70 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion(draft);
          }}
        >
          <label htmlFor="agent-question" className="sr-only">
            Ask a property intelligence question
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              id="agent-question"
              rows={3}
              value={draft}
              disabled={ask.isPending}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about parcels, ownership, or data-center suitability…"
              className="input-base min-h-[5.5rem] flex-1 resize-y"
            />
            <button
              type="submit"
              disabled={ask.isPending || !draft.trim()}
              className="btn-primary shrink-0 gap-2"
            >
              {ask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

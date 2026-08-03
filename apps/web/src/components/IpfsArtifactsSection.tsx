"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { ArtifactsResponse, IpfsArtifact } from "@oracle/shared";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function CidCopyChip({ cid }: { cid: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(cid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy CID"
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 focus-ring"
    >
      <span className="truncate">{cid}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy CID"}</span>
    </button>
  );
}

function ArtifactRow({ artifact }: { artifact: IpfsArtifact }) {
  return (
    <li className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-slate-900">{artifact.name}</p>
        <p className="text-xs text-slate-500">{artifact.description}</p>
        <p className="text-xs tabular-nums text-slate-600">{formatBytes(artifact.bytes)}</p>
        <CidCopyChip cid={artifact.cid} />
      </div>
      <a
        href={artifact.gatewayUrl}
        target="_blank"
        rel="noreferrer"
        className="btn-secondary shrink-0 gap-1.5 self-start text-xs"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        Open on IPFS
      </a>
    </li>
  );
}

interface IpfsArtifactsSectionProps {
  artifacts: ArtifactsResponse | null;
}

/** Decentralized storage section for the run summary. Hidden when no artifacts. */
export function IpfsArtifactsSection({ artifacts }: IpfsArtifactsSectionProps) {
  if (!artifacts || artifacts.artifacts.length === 0) return null;

  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Decentralized storage (IPFS)</h2>
        {artifacts.note ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{artifacts.note}</p>
        ) : null}
      </div>
      <ul>
        {artifacts.artifacts.map((artifact) => (
          <ArtifactRow key={artifact.cid} artifact={artifact} />
        ))}
      </ul>
    </section>
  );
}

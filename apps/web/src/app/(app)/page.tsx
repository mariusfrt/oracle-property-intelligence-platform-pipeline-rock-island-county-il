import { RunSummary } from "@/components/RunSummary";
import { createApiClient } from "@/lib/trpc";
import type { ArtifactsResponse, SummaryResponse } from "@oracle/shared";

export const dynamic = "force-dynamic";

/** Home: live pipeline run summary. */
export default async function HomePage() {
  let summary: SummaryResponse | null = null;
  let artifacts: ArtifactsResponse | null = null;

  try {
    const client = createApiClient();
    const [summaryResult, artifactsResult] = await Promise.all([
      client.parcels.summary.query(),
      client.artifacts.list.query(),
    ]);
    summary = summaryResult;
    artifacts = artifactsResult;
  } catch {
    summary = null;
    artifacts = null;
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <RunSummary summary={summary} artifacts={artifacts} />
    </div>
  );
}

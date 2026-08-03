import { RunSummary } from "@/components/RunSummary";
import { createApiClient } from "@/lib/trpc";

export const dynamic = "force-dynamic";

/** Home — pipeline run summary (demo screen 1). */
export default async function HomePage() {
  let summary = null;

  try {
    const client = createApiClient();
    summary = await client.parcels.summary.query();
  } catch {
    summary = null;
  }

  return <RunSummary summary={summary} />;
}

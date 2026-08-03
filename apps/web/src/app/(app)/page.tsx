import { RunSummary } from "@/components/RunSummary";
import { createApiClient } from "@/lib/trpc";

export const dynamic = "force-dynamic";

/** Home: live pipeline run summary. */
export default async function HomePage() {
  let summary = null;

  try {
    const client = createApiClient();
    summary = await client.parcels.summary.query();
  } catch {
    summary = null;
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <RunSummary summary={summary} />
    </div>
  );
}

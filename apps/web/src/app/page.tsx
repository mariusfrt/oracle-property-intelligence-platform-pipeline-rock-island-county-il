import { RunSummary } from "@/components/RunSummary";

/** Home — pipeline run summary (demo screen 1). */
export default function HomePage() {
  // TODO: fetch trpc.parcels.summary when API is deployed
  return <RunSummary summary={null} />;
}

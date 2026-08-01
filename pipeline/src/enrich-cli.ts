#!/usr/bin/env node
import { buildParcelsEnriched } from "./enrichment/build.js";
import { exportParcelsEnriched } from "./enrichment/export-enriched.js";
import { fetchEnrichmentLayers } from "./enrichment/fetch.js";
import { loadEnrichmentLayers } from "./enrichment/load.js";
import { writeEnrichmentRunRecord } from "./enrichment/record.js";

function printUsage(): void {
  console.log(`Usage:
  pnpm --filter @oracle/pipeline enrich fetch [--pilot|--full]
  pnpm --filter @oracle/pipeline enrich load
  pnpm --filter @oracle/pipeline enrich build [--pilot|--full]
  pnpm --filter @oracle/pipeline enrich export
  pnpm --filter @oracle/pipeline enrich record [--pilot|--full]
  pnpm --filter @oracle/pipeline enrich run [--pilot|--full]

Options:
  --pilot   Tag run-record as pilot (parcel subset comes from Phase 1 ingest)
  --full    Tag run-record as full county run`);
}

function parseMode(args: string[]): { pilot: boolean; full: boolean; mode: "pilot" | "full" } {
  const full = args.includes("--full");
  const pilot = args.includes("--pilot") || !full;
  return { pilot, full, mode: full ? "full" : "pilot" };
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(command ? 0 : 1);
  }

  const { mode } = parseMode(rest);

  try {
    switch (command) {
      case "fetch": {
        const result = await fetchEnrichmentLayers({ pilot: mode === "pilot", full: mode === "full" });
        console.log(
          `enrich fetch complete: ${result.layers.length} layer(s), ${result.layers.reduce((n, l) => n + l.elementCount, 0)} element(s)`,
        );
        break;
      }
      case "load": {
        const result = await loadEnrichmentLayers();
        console.log(
          `enrich load complete: ${result.powerLines} lines, ${result.powerSubstations} substations, ${result.poiTransit + result.poiStarbucks + result.poiWater} poi`,
        );
        break;
      }
      case "build": {
        const result = await buildParcelsEnriched();
        console.log(`enrich build complete: ${result.rowCount} enriched row(s)`);
        break;
      }
      case "export": {
        const result = await exportParcelsEnriched();
        console.log(`enrich export complete: ${result.parquetPath} (${result.rowCount} rows)`);
        break;
      }
      case "record": {
        const { recordPath } = await writeEnrichmentRunRecord({ mode });
        console.log(`enrich record complete: ${recordPath}`);
        break;
      }
      case "run": {
        const fetchResult = await fetchEnrichmentLayers({ pilot: mode === "pilot", full: mode === "full" });
        const loadResult = await loadEnrichmentLayers();
        const buildResult = await buildParcelsEnriched();
        const exportResult = await exportParcelsEnriched();
        const { recordPath } = await writeEnrichmentRunRecord({
          mode,
          fetchLayers: fetchResult.layers,
        });
        console.log("enrich run complete:");
        console.log(`  fetch:  ${fetchResult.layers.reduce((n, l) => n + l.elementCount, 0)} element(s)`);
        console.log(
          `  load:   ${loadResult.powerLines} lines, ${loadResult.powerSubstations} substations`,
        );
        console.log(`  build:  ${buildResult.rowCount} enriched row(s)`);
        console.log(`  export: ${exportResult.parquetPath}`);
        console.log(`  record: ${recordPath}`);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
import { exportParcels } from "./export.js";
import { normalizeParcels } from "./normalize.js";
import { pullParcels } from "./pull.js";

function printUsage(): void {
  console.log(`Usage:
  pnpm --filter @oracle/pipeline ingest pull [--pilot|--full]
  pnpm --filter @oracle/pipeline ingest normalize
  pnpm --filter @oracle/pipeline ingest export
  pnpm --filter @oracle/pipeline ingest run [--pilot|--full]

Options:
  --pilot   Pull first 200 parcels (default for pull/run)
  --full    Pull all county pages (~33 requests)`);
}

function parseMode(args: string[]): { pilot: boolean; full: boolean } {
  const full = args.includes("--full");
  const pilot = args.includes("--pilot") || !full;
  return { pilot, full };
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(command ? 0 : 1);
  }

  try {
    switch (command) {
      case "pull": {
        const mode = parseMode(rest);
        const result = await pullParcels(mode);
        console.log(
          `pull complete: ${result.pagesWritten} page(s), ${result.featureCount} feature(s)`,
        );
        break;
      }
      case "normalize": {
        const result = await normalizeParcels();
        console.log(
          `normalize complete: ${result.pagesProcessed} page(s), ${result.rowCount} row(s) in DuckDB`,
        );
        break;
      }
      case "export": {
        const result = await exportParcels();
        console.log(`export complete: ${result.parquetPath} (${result.rowCount} rows)`);
        break;
      }
      case "run": {
        const mode = parseMode(rest);
        const pullResult = await pullParcels(mode);
        const normalizeResult = await normalizeParcels();
        const exportResult = await exportParcels();
        console.log("run complete:");
        console.log(`  pull:      ${pullResult.featureCount} feature(s) in ${pullResult.pagesWritten} page(s)`);
        console.log(`  normalize: ${normalizeResult.rowCount} row(s)`);
        console.log(`  export:    ${exportResult.parquetPath}`);
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

import fs from "node:fs/promises";
import {
  artifactsResponseSchema,
  ipfsManifestSchema,
  type ArtifactsResponse,
} from "@oracle/shared";
import { getIpfsManifestPath } from "../db/duckdb.js";
import { loggedProcedure, router } from "../trpc.js";

async function loadArtifactsManifest(): Promise<ArtifactsResponse> {
  const manifestPath = getIpfsManifestPath();
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = ipfsManifestSchema.parse(JSON.parse(raw));
    return artifactsResponseSchema.parse(parsed);
  } catch {
    return { artifacts: [] };
  }
}

export const artifactsRouter = router({
  list: loggedProcedure.query(async (): Promise<ArtifactsResponse> => {
    return loadArtifactsManifest();
  }),
});

export type ArtifactsRouter = typeof artifactsRouter;

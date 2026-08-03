import { z } from "zod";

export const ipfsArtifactSchema = z.object({
  name: z.string(),
  description: z.string(),
  cid: z.string(),
  bytes: z.number().int().nonnegative(),
  gatewayUrl: z.string(),
});

export type IpfsArtifact = z.infer<typeof ipfsArtifactSchema>;

export const ipfsManifestSchema = z.object({
  generatedAt: z.string(),
  gateway: z.string(),
  note: z.string(),
  artifacts: z.array(ipfsArtifactSchema),
});

export type IpfsManifest = z.infer<typeof ipfsManifestSchema>;

/** Response from the artifacts query (empty when no manifest is bundled). */
export const artifactsResponseSchema = z.object({
  generatedAt: z.string().optional(),
  gateway: z.string().optional(),
  note: z.string().optional(),
  artifacts: z.array(ipfsArtifactSchema),
});

export type ArtifactsResponse = z.infer<typeof artifactsResponseSchema>;

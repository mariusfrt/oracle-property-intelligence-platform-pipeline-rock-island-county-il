import { z } from "zod";

/** Provenance fields carried on every API response row. */
export const provenanceSchema = z.object({
  source_system: z.string().nullable(),
  source_url: z.string().nullable(),
  retrieved_at: z.string().nullable(),
});

export type Provenance = z.infer<typeof provenanceSchema>;

export const provenanceFields = ["source_system", "source_url", "retrieved_at"] as const;

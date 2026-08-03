import {
  dataCenterCandidatesInputSchema,
  parcelIdSchema,
  presetQueryInputSchema,
  searchParcelsInputSchema,
  type PagedParcelsResponse,
  type SummaryResponse,
} from "@oracle/shared";
import { loggedProcedure, router } from "../trpc.js";
import {
  buildDataCenterWhereClause,
  buildPresetWhereClause,
  buildSearchWhereClause,
  dataCenterCandidates,
  getParcelByObjectId,
  presetQuery,
  searchParcels,
} from "../queries/parcels.js";
import { getDatasetSummary } from "../queries/dataset.js";

export {
  buildDataCenterWhereClause,
  buildPresetWhereClause,
  buildSearchWhereClause,
};

export const parcelsRouter = router({
  summary: loggedProcedure.query(async ({ ctx }): Promise<SummaryResponse> => {
    return getDatasetSummary(ctx.duckdb);
  }),

  searchParcels: loggedProcedure
    .input(searchParcelsInputSchema)
    .query(async ({ ctx, input }): Promise<PagedParcelsResponse> => {
      return searchParcels(ctx.duckdb, input);
    }),

  parcel: loggedProcedure.input(parcelIdSchema).query(async ({ ctx, input }) => {
    const parcel = await getParcelByObjectId(ctx.duckdb, input.objectid);
    return { parcel };
  }),

  dataCenterCandidates: loggedProcedure
    .input(dataCenterCandidatesInputSchema)
    .query(async ({ ctx, input }): Promise<PagedParcelsResponse> => {
      return dataCenterCandidates(ctx.duckdb, input);
    }),

  presetQuery: loggedProcedure.input(presetQueryInputSchema).query(async ({ ctx, input }) => {
    return presetQuery(ctx.duckdb, input);
  }),
});

export type ParcelsRouter = typeof parcelsRouter;

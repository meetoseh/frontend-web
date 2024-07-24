import { CrudFetcherMapper, SimpleFilterItem } from '../../crud/CrudFetcher';

/**
 * Describes something that can be checked during trigger or peek time to get
 * a boolean true or false. All included conditions must be true for the predicate
 * as a whole to be true.
 */
export type ClientFlowPredicate = {
  /** If provided and not null, the restriction on the client-provided version hint */
  version?: SimpleFilterItem | null;
};

export const clientFlowPredicateMapper: CrudFetcherMapper<ClientFlowPredicate> = {};
export const serializeClientFlowPredicate = (x: ClientFlowPredicate): any => ({
  ...(x.version !== undefined && x.version !== null ? { version: x.version } : {}),
});

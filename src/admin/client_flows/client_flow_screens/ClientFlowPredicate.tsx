import { CrudFetcherMapper, SimpleFilterItem } from '../../crud/CrudFetcher';

/**
 * Describes something that can be checked during trigger or peek time to get
 * a boolean true or false. All included conditions must be true for the predicate
 * as a whole to be true.
 */
export type ClientFlowPredicate = {
  /** If provided and not null, the restriction on the client-provided version hint */
  version?: SimpleFilterItem | null;
  timeInQueue?: SimpleFilterItem | null;
  accountAge?: SimpleFilterItem | null;
};

export const clientFlowPredicateMapper: CrudFetcherMapper<ClientFlowPredicate> = {
  time_in_queue: 'timeInQueue',
  account_age: 'accountAge',
};
export const serializeClientFlowPredicate = (x: ClientFlowPredicate): any => ({
  ...(x.version !== undefined && x.version !== null ? { version: x.version } : {}),
  ...(x.timeInQueue !== undefined && x.timeInQueue !== null
    ? { time_in_queue: x.timeInQueue }
    : {}),
  ...(x.accountAge !== undefined && x.accountAge !== null ? { account_age: x.accountAge } : {}),
});

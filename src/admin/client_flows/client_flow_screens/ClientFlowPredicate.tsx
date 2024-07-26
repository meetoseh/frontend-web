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

export const clientFlowPredicateMapper: CrudFetcherMapper<ClientFlowPredicate> = (raw) => {
  const result = {} as any;
  if (raw.version !== undefined && raw.version !== null) {
    result.version = raw.version;
  }
  if (raw.time_in_queue !== undefined && raw.time_in_queue !== null) {
    result.timeInQueue = raw.time_in_queue;
  }
  if (raw.account_age !== undefined && raw.account_age !== null) {
    result.accountAge = raw.account_age;
  }
  return result as ClientFlowPredicate;
};
export const serializeClientFlowPredicate = (x: ClientFlowPredicate): any => ({
  ...(x.version !== undefined && x.version !== null ? { version: x.version } : {}),
  ...(x.timeInQueue !== undefined && x.timeInQueue !== null
    ? { time_in_queue: x.timeInQueue }
    : {}),
  ...(x.accountAge !== undefined && x.accountAge !== null ? { account_age: x.accountAge } : {}),
});

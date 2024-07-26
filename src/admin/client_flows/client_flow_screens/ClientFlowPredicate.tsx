import { CrudFetcherMapper, SimpleFilterItem } from '../../crud/CrudFetcher';

/**
 * Describes something that can be checked during trigger or peek time to get
 * a boolean true or false. All included conditions must be true for the predicate
 * as a whole to be true.
 */
export type ClientFlowPredicate = {
  /** client-provided version hint, generally matches an android version code */
  version?: SimpleFilterItem | null;
  /** time spent in the queue in seconds */
  timeInQueue?: SimpleFilterItem | null;
  /** time since the users account was created in seconds */
  accountAge?: SimpleFilterItem | null;
  /**
   * each group gives a random 0 or 1 value for every user. group names are case insensitive
   * and created if missing. group names are not normalized into titleCase, so prefer values
   * that are the same in titleCase and snake_case. where not possible, use snake_case.
   */
  stickyRandomGroups?: { [groupName: string]: SimpleFilterItem } | null;
  /** a random float between 0 and 1 */
  randomFloat?: SimpleFilterItem | null;
};

export const clientFlowPredicateMapper: CrudFetcherMapper<ClientFlowPredicate> = (raw) => {
  const result: ClientFlowPredicate = {};
  if (raw.version !== undefined && raw.version !== null) {
    result.version = raw.version;
  }
  if (raw.time_in_queue !== undefined && raw.time_in_queue !== null) {
    result.timeInQueue = raw.time_in_queue;
  }
  if (raw.account_age !== undefined && raw.account_age !== null) {
    result.accountAge = raw.account_age;
  }
  if (raw.sticky_random_groups !== undefined && raw.sticky_random_groups !== null) {
    result.stickyRandomGroups = raw.sticky_random_groups;
  }
  if (raw.random_float !== undefined && raw.random_float !== null) {
    result.randomFloat = raw.random_float;
  }
  return result;
};
export const serializeClientFlowPredicate = (x: ClientFlowPredicate): any => ({
  ...(x.version !== undefined && x.version !== null ? { version: x.version } : {}),
  ...(x.timeInQueue !== undefined && x.timeInQueue !== null
    ? { time_in_queue: x.timeInQueue }
    : {}),
  ...(x.accountAge !== undefined && x.accountAge !== null ? { account_age: x.accountAge } : {}),
  ...(x.stickyRandomGroups !== undefined && x.stickyRandomGroups !== null
    ? { sticky_random_groups: x.stickyRandomGroups }
    : {}),
  ...(x.randomFloat !== undefined && x.randomFloat !== null ? { random_float: x.randomFloat } : {}),
});

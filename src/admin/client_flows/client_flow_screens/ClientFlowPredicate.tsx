import { convertUsingMapper, CrudFetcherMapper, SimpleFilterItem } from '../../crud/CrudFetcher';

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
  /**
   * each group gives a 1 if the user is in the group and a 0 if the user is not in the
   * group. the user has to do something to join groups, usually the
   * `pop_joining_opt_in_group` endpoint for triggers.
   */
  optInGroups?: { [groupName: string]: SimpleFilterItem } | null;
  /** a random float between 0 and 1 */
  randomFloat?: SimpleFilterItem | null;
  /**
   * Allows recursively producing any logical combination of these
   */
  or?: ClientFlowPredicate | null;
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
  if (raw.opt_in_groups !== undefined && raw.opt_in_groups !== null) {
    result.optInGroups = raw.opt_in_groups;
  }
  if (raw.random_float !== undefined && raw.random_float !== null) {
    result.randomFloat = raw.random_float;
  }
  if (raw.or_predicate !== undefined && raw.or_predicate !== null) {
    result.or = convertUsingMapper(raw.or_predicate, clientFlowPredicateMapper);
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
  ...(x.optInGroups !== undefined && x.optInGroups !== null
    ? { opt_in_groups: x.optInGroups }
    : {}),
  ...(x.randomFloat !== undefined && x.randomFloat !== null ? { random_float: x.randomFloat } : {}),
  ...(x.or !== undefined && x.or !== null
    ? { or_predicate: serializeClientFlowPredicate(x.or) }
    : {}),
});

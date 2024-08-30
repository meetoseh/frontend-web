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
  /** when the screen was added to the queue in seconds since the epoch */
  queuedAt?: SimpleFilterItem | null;
  /** time since the users account was created in seconds */
  accountAge?: SimpleFilterItem | null;
  /** time when the users account was created in seconds since the epoch */
  accountCreatedAt?: SimpleFilterItem | null;
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
   * The users rating to the journey they most recently took.
   * null - didn't rate
   * 1 - loved
   * 2 - liked
   * 3 - disliked
   * 4 - hated
   */
  lastJourneyRating?: SimpleFilterItem | null;
  /**
   * The number of journeys the user took today
   */
  journeysToday?: SimpleFilterItem | null;
  /**
   * The number of journal entries by the user created today that do not have
   * the hide from my journal flag set (i.e., they posted the reflection response)
   */
  journalEntriesInHistoryToday?: SimpleFilterItem | null;
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
  if (raw.queued_at !== undefined && raw.queued_at !== null) {
    result.queuedAt = raw.queued_at;
  }
  if (raw.account_age !== undefined && raw.account_age !== null) {
    result.accountAge = raw.account_age;
  }
  if (raw.account_created_at !== undefined && raw.account_created_at !== null) {
    result.accountCreatedAt = raw.account_created_at;
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
  if (raw.last_journey_rating !== undefined && raw.last_journey_rating !== null) {
    result.lastJourneyRating = raw.last_journey_rating;
  }
  if (raw.journeys_today !== undefined && raw.journeys_today !== null) {
    result.journeysToday = raw.journeys_today;
  }
  if (
    raw.journal_entries_in_history_today !== undefined &&
    raw.journal_entries_in_history_today !== null
  ) {
    result.journalEntriesInHistoryToday = raw.journal_entries_in_history_today;
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
  ...(x.queuedAt !== undefined && x.queuedAt !== null ? { queued_at: x.queuedAt } : {}),
  ...(x.accountAge !== undefined && x.accountAge !== null ? { account_age: x.accountAge } : {}),
  ...(x.accountCreatedAt !== undefined && x.accountCreatedAt !== null
    ? { account_created_at: x.accountCreatedAt }
    : {}),
  ...(x.stickyRandomGroups !== undefined && x.stickyRandomGroups !== null
    ? { sticky_random_groups: x.stickyRandomGroups }
    : {}),
  ...(x.optInGroups !== undefined && x.optInGroups !== null
    ? { opt_in_groups: x.optInGroups }
    : {}),
  ...(x.randomFloat !== undefined && x.randomFloat !== null ? { random_float: x.randomFloat } : {}),
  ...(x.lastJourneyRating !== undefined && x.lastJourneyRating !== null
    ? { last_journey_rating: x.lastJourneyRating }
    : {}),
  ...(x.journeysToday !== undefined && x.journeysToday !== null
    ? { journeys_today: x.journeysToday }
    : {}),
  ...(x.journalEntriesInHistoryToday !== undefined && x.journalEntriesInHistoryToday !== null
    ? { journal_entries_in_history_today: x.journalEntriesInHistoryToday }
    : {}),
  ...(x.or !== undefined && x.or !== null
    ? { or_predicate: serializeClientFlowPredicate(x.or) }
    : {}),
});

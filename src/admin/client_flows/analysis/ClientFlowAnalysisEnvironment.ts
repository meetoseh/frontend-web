import { VISITOR_SOURCE } from '../../../shared/lib/visitorSource';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

/**
 * The state of a user for the purposes of checking predicates while analyzing a client
 * flow. Thus, this uniquely identifies a client flow graph.
 */
export type ClientFlowAnalysisEnvironment = {
  /** What SCREEN_VERSION the client is providing */
  version: number | null;
  /** When the user created their account in seconds since the epoch */
  accountCreatedAt: number;
  /**
   * The current time in seconds since the epoch. NOTE: Since it rarely needs
   * to be very granular, using e.g. the start of the current hour or a specific
   * time of day is fine and will improve cacheability (and thus performance).
   */
  now: number;

  /**
   * The rating the user gave to their last journey, or null if they either haven't
   * taken a journey or they did not rate the last journey they took
   * - 1: loved
   * - 2: liked
   * - 3: disliked
   * - 4: hated
   */
  lastJourneyRating: number | null;

  /** How many journeys they took today */
  journeysToday: number;

  /** How many journal entries they created today that would show up in their My Journal */
  journalEntriesInHistoryToday: number;

  /** True if they are an Oseh+ subscriber, false if they are not */
  hasOsehPlus: boolean;

  /** True if they have a recoverable identity (apple, google, direct) attached, false otherwise */
  hasRecoverableIdentity: boolean;

  /** The platform they are using */
  platform: typeof VISITOR_SOURCE;
};

export type ClientFlowAnalysisEnvironmentAPI = {
  version: number | null;
  account_created_at: number;
  now: number;
  last_journey_rating: number | null;
  journeys_today: number;
  journal_entries_in_history_today: number;
  has_oseh_plus: boolean;
  has_recoverable_identity: boolean;
  platform: typeof VISITOR_SOURCE;
};

export const clientFlowAnalysisEnvironmentMapper: CrudFetcherMapper<ClientFlowAnalysisEnvironment> =
  {
    account_created_at: 'accountCreatedAt',
    last_journey_rating: 'lastJourneyRating',
    journeys_today: 'journeysToday',
    journal_entries_in_history_today: 'journalEntriesInHistoryToday',
    has_oseh_plus: 'hasOsehPlus',
    has_recoverable_identity: 'hasRecoverableIdentity',
  };

export const convertClientFlowAnalysisEnvironmentToAPI = (
  settings: ClientFlowAnalysisEnvironment
): ClientFlowAnalysisEnvironmentAPI => ({
  version: settings.version,
  account_created_at: settings.accountCreatedAt,
  now: settings.now,
  last_journey_rating: settings.lastJourneyRating,
  journeys_today: settings.journeysToday,
  journal_entries_in_history_today: settings.journalEntriesInHistoryToday,
  has_oseh_plus: settings.hasOsehPlus,
  has_recoverable_identity: settings.hasRecoverableIdentity,
  platform: settings.platform,
});

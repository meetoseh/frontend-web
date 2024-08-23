import { convertUsingMapper, CrudFetcherMapper } from '../../../../../admin/crud/CrudFetcher';

export type SearchPublicJourneyInstructorAPI = {
  /** The primary stable external identifier */
  uid: string;

  /** Their full display name */
  name: string;
};

export type SearchPublicJourneyInstructor = SearchPublicJourneyInstructorAPI;
export const searchPublicJourneyInstructorMapper: CrudFetcherMapper<SearchPublicJourneyInstructor> =
  {};

export type SearchPublicJourneyAPI = {
  /** The primary stable external identifier */
  uid: string;
  /** The short-ish title */
  title: string;
  /** The duration of the journey, as an integer number of seconds (rounded up) */
  duration_seconds: number;
  /** Who taught the class */
  instructor: SearchPublicJourneyInstructorAPI;
  /**
   * When the user last took this class, in fractional seconds since the epoch. Null or undefined
   * if the user has never taken the class
   */
  last_taken_at?: number | null;
  /**
   * If the class is currently favorited by the user, the time when it was favorited, in fractional
   * seconds since the epoch. Null or undefined if the user has not favorited the class
   */
  liked_at?: number | null;
  /** True if this journey requires Oseh+ to take, false otherwise */
  requires_pro: boolean;
};

export type SearchPublicJourney = {
  /** The primary stable external identifier */
  uid: string;
  /** The short-ish title */
  title: string;
  /** The duration of the journey, as an integer number of seconds (rounded up) */
  durationSeconds: number;
  /** Who taught the class */
  instructor: SearchPublicJourneyInstructor;
  /**
   * When the user last took this class. Null if the user has never taken the class
   */
  lastTakenAt: Date | null;
  /**
   * If the class is currently favorited by the user, the time when it was favorited.
   * Null if the user has not favorited the class
   */
  likedAt: Date | null;
  /** True if this journey requires Oseh+ to take, false otherwise */
  requiresPro: boolean;
};

export const searchPublicJourneyMapper: CrudFetcherMapper<SearchPublicJourney> = (raw) => {
  const api = raw as SearchPublicJourneyAPI;
  return {
    uid: api.uid,
    title: api.title,
    durationSeconds: api.duration_seconds,
    instructor: convertUsingMapper(api.instructor, searchPublicJourneyInstructorMapper),
    lastTakenAt:
      api.last_taken_at === null || api.last_taken_at === undefined
        ? null
        : new Date(api.last_taken_at * 1000),
    likedAt:
      api.liked_at === null || api.liked_at === undefined ? null : new Date(api.liked_at * 1000),
    requiresPro: api.requires_pro,
  };
};

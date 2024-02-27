import { CrudFetcherMapper } from '../../../admin/crud/CrudFetcher';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { OsehPublicImageRef } from '../../../shared/images/OsehPublicImageRef';

/**
 * A minimal representation of a journey, which is used for listing large
 * numbers of journeys, such as when viewing your history or favorites
 */
export type MinimalJourney = {
  /**
   * The stable unique identifier for the journey
   */
  uid: string;

  /**
   * The title of the journey
   */
  title: string;

  /**
   * The ~100 character description of the journey
   */
  description: string;

  /**
   * The image to use as the background for the journey in a compact view
   */
  darkenedBackground: OsehImageRef | OsehPublicImageRef;

  /**
   * The duration of the journey in seconds
   */
  durationSeconds: number;

  /**
   * The main actor / actress for the journey
   */
  instructor: {
    /**
     * The name of the actor / actress
     */
    name: string;

    /**
     * Their profile picture
     */
    image: OsehImageRef | OsehPublicImageRef;
  };

  /**
   * When the logged in user last took this journey, or null if they have not
   * taken it
   */
  lastTakenAt: Date | null;

  /**
   * When the logged in user last liked this journey, or null if they have not
   * liked it
   */
  likedAt: Date | null;
};

/**
 * Allows converting from the raw api response to our internal representation
 */
export const minimalJourneyKeyMap: CrudFetcherMapper<MinimalJourney> = {
  darkened_background: 'darkenedBackground',
  duration_seconds: 'durationSeconds',
  last_taken_at: (_, v) => ({ key: 'lastTakenAt', value: v ? new Date(v * 1000) : null }),
  liked_at: (_, v) => ({ key: 'likedAt', value: v ? new Date(v * 1000) : null }),
};

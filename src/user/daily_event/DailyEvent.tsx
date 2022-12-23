import { convertUsingKeymap, CrudFetcherKeyMap } from '../../admin/crud/CrudFetcher';
import { OsehImageRef } from '../../shared/OsehImage';

export type DailyEventJourney = {
  /**
   * Primary stable external identifier for the journey
   */
  uid: string;

  /**
   * The category the journey belongs to, as it should be displayed to the user
   */
  category: { externalName: string };

  /**
   * The title for the journey, very short
   */
  title: string;

  /**
   * The name of the journeys instructor
   */
  instructor: { name: string };

  /**
   * The slightly longer description of the journey
   */
  description: { text: string };

  /**
   * The background image for the journey & preview
   */
  backgroundImage: OsehImageRef;

  /**
   * If the user can start this journey directly using the provided jwt
   */
  access: { start: boolean };
};

export type DailyEvent = {
  /**
   * The primary stable external identifier for the event
   */
  uid: string;

  /**
   * The JWT that can be used to perform actions on the event. This is
   * generally single-use
   */
  jwt: string;

  /**
   * The journeys that are part of the event
   */
  journeys: DailyEventJourney[];

  /**
   * If the user is allowed to start a random journey within the event
   */
  access: { startRandom: boolean };
};

/**
 * Describes the necessary transformations from the api representation to
 * our internal representation of a daily event journey
 */
export const deJourneyKeyMap: CrudFetcherKeyMap<DailyEventJourney> = {
  category: (_, val: { external_name: string }) => ({
    key: 'category',
    value: { externalName: val.external_name },
  }),
  background_image: 'backgroundImage',
};

/**
 * Describes the necessary transformations from the api representation to
 * our internal representation of an external daily event
 */
export const keyMap: CrudFetcherKeyMap<DailyEvent> = {
  journeys: (_, val: any[]) => ({
    key: 'journeys',
    value: val.map((i) => convertUsingKeymap(i, deJourneyKeyMap)),
  }),
  access: (_, val: { start_random: boolean }) => ({
    key: 'access',
    value: { startRandom: val.start_random },
  }),
};

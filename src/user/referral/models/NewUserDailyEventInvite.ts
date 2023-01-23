import { convertUsingKeymap, CrudFetcherKeyMap } from '../../../admin/crud/CrudFetcher';
import { OsehImageRef } from '../../../shared/OsehImage';

type DeepLinkInfo = {
  /**
   * Reserved for later
   */
  type: 'journey';

  /**
   * The name of the instructor
   */
  instructor: string;

  /**
   * The name of the journey
   */
  title: string;

  /**
   * The background image for the journey; can be downloaded and sent
   * alongside the url. Note as with all oseh image refs, this url
   * is only valid for a short period of time
   */
  backgroundImage: OsehImageRef;
};

/**
 * Describes the parsed response from the server when creating a new user
 * daily event invite
 */
export type NewUserDailyEventInvite = {
  /**
   * The code that recipients can use to join the daily event / journey,
   * and potentially earn rewards
   */
  code: string;

  /**
   * The standard url that we direct users to which will automatically
   * redeem the code
   */
  url: string;

  /**
   * True if recipients who don't already have Oseh+ and haven't already
   * used this particular code will be given Oseh+ for 1 day
   */
  isPlusLink: boolean;

  /**
   * Some information about the daily event that users will be directed
   * to when using the url, if the code is still valid. Note the url
   * will work when the code is not valid, but they might get a different
   * daily event
   */
  dailyEventInfo: {
    /**
     * The names of the instructors on the journeys in the event
     */
    instructors: string[];
  };

  /**
   * If the link goes directly to a journey when valid, information about
   * the journey it goes to
   */
  deepLinkInfo: DeepLinkInfo | null;
};

const deepLinkInfoKeyMap: CrudFetcherKeyMap<DeepLinkInfo> = {
  background_image: 'backgroundImage',
};

/**
 * The key map for converting the response from the server
 */
export const keyMap: CrudFetcherKeyMap<NewUserDailyEventInvite> = {
  is_plus_link: 'isPlusLink',
  daily_event_info: 'dailyEventInfo',
  deep_link_info: (_, val) => ({
    key: 'deepLinkInfo',
    value: convertUsingKeymap(val, deepLinkInfoKeyMap),
  }),
};

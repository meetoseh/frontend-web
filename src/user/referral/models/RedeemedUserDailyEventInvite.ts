import { convertUsingKeymap, CrudFetcherKeyMap } from '../../../admin/crud/CrudFetcher';
import { DailyEvent, keyMap as dailyEventKeyMap } from '../../daily_event/DailyEvent';
import { JourneyRef, journeyRefKeyMap } from '../../journey/models/JourneyRef';

/**
 * Describes the interpreted response from the server when redeeming a user
 * daily event invite
 */
export type RedeemedUserDailyEventInvite = {
  /**
   * The first name of the person who sent the invite
   */
  senderName: string;

  /**
   * If the user should be directed to a daily event, the daily event to
   * redirect the user to
   */
  dailyEvent: DailyEvent | null;

  /**
   * If the user should be directed to a journey, the journey to redirect the
   * user to
   */
  journey: JourneyRef | null;

  /**
   * If the user received oseh plus as a result of redeeming the invite
   */
  receivedOsehPlus: boolean;
};

/**
 * The key map for converting the response from the server
 */
export const keyMap: CrudFetcherKeyMap<RedeemedUserDailyEventInvite> = {
  sender_name: 'senderName',
  daily_event: (_, val) => ({
    key: 'dailyEvent',
    value: val !== null && val !== undefined ? convertUsingKeymap(val, dailyEventKeyMap) : null,
  }),
  journey: (_, val) => ({
    key: 'journey',
    value: val !== null && val !== undefined ? convertUsingKeymap(val, journeyRefKeyMap) : null,
  }),
  received_oseh_plus: 'receivedOsehPlus',
};

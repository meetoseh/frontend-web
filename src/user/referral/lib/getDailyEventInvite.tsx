import { convertUsingKeymap } from '../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContextValue } from '../../../shared/LoginContext';
import {
  NewUserDailyEventInvite,
  keyMap as newUseDailyEventInviteKeyMap,
} from '../models/NewUserDailyEventInvite';

/**
 * Fetches the users current daily event invite for the given journey,
 * or just the current daily event if journeyUid is null.
 *
 * Rejects with either a TypeError (network error) or a Response (server error).
 *
 * @param loginContext The login context
 * @param journeyUid The journey uid, or null for the current daily event
 * @returns The daily event invite
 */
export const getDailyEventInvite = async ({
  loginContext,
  journeyUid,
}: {
  loginContext: LoginContextValue;
  journeyUid: string | null;
}): Promise<NewUserDailyEventInvite> => {
  const response = await apiFetch(
    '/api/1/referral/user_daily_event_invites/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        journey_uid: journeyUid,
      }),
    },
    loginContext
  );

  if (!response.ok) {
    throw response;
  }

  const data = await response.json();
  return convertUsingKeymap(data, newUseDailyEventInviteKeyMap);
};

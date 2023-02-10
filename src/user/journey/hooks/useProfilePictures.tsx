import { useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/LoginContext';
import { OsehImageRef } from '../../../shared/OsehImage';
import { JourneyTime, useCoarseTime } from './useJourneyTime';

/**
 * The profile pictures that should be shown at the top of the
 * journey so that the user can see who else is on the journey.
 * This is a small number of users with profile pictures,
 * preferring more relevant users.
 */
export type ProfilePictures = {
  pictures: OsehImageRef[];
};

type ProfilePictureKwargs = {
  /**
   * The UID of the journey to get profile pictures for
   */
  journeyUid: string;

  /**
   * The JWT for the journey to get profile pictures for
   */
  journeyJwt: string;

  /**
   * How long the journey is in seconds
   */
  journeyLobbyDurationSeconds: number;

  /**
   * The journey time from our perspective, which is used to determine when
   * certain profile pictures should be shown
   */
  journeyTime: JourneyTime;
};

/**
 * Fetches a list of profile pictures for users taking the journey,
 * updating those pictures as the journey progresses to account for
 * users coming/going and to add some variety.
 *
 * Requires a login context.
 */
export const useProfilePictures = ({
  journeyUid,
  journeyJwt,
  journeyLobbyDurationSeconds,
  journeyTime,
}: ProfilePictureKwargs): ProfilePictures => {
  const loginContext = useContext(LoginContext);
  const [pictures, setPictures] = useState<OsehImageRef[]>([]);
  const coarsenedTime = useCoarseTime(journeyTime, 2000, -250, true);

  useEffect(() => {
    const journeyTime = coarsenedTime * 2;
    if (journeyTime >= journeyLobbyDurationSeconds) {
      return;
    }

    let active = true;
    fetchPictures();
    return () => {
      active = false;
    };

    async function fetchPictures() {
      if (loginContext.state !== 'logged-in') {
        console.log('skipping profile pictures at', journeyTime, '; not logged in');
        return;
      }

      try {
        const response = await apiFetch(
          '/api/1/journeys/profile_pictures',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              uid: journeyUid,
              jwt: journeyJwt,
              journey_time: journeyTime,
              limit: 7,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data: { items: { picture: OsehImageRef }[] } = await response.json();
        if (!active) {
          return;
        }

        setPictures(data.items.map((item) => item.picture));
      } catch (e) {
        if (e instanceof TypeError) {
          console.error('failed to connect to server for profile pictures at ', journeyTime);
        } else if (e instanceof Response) {
          const data = await e.json();
          console.error(
            'received non-success response from server for profile pictures at ',
            journeyTime,
            ': ',
            data
          );
        } else {
          console.error('unknown error while fetching profile pictures at ', journeyTime, ': ', e);
        }
      }
    }
  }, [coarsenedTime, journeyUid, journeyJwt, journeyLobbyDurationSeconds, loginContext]);

  return { pictures };
};

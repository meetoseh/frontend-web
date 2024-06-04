import { ReactElement } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { ScreenContext } from '../../../hooks/useScreenContext';
import { ScreenJourneyMapped } from '../../../models/ScreenJourney';
import { makePrettyResponse } from './makePrettyResponse';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { describeError } from '../../../../../shared/forms/ErrorBlock';

/**
 * Stores the feedback for a user about a journey, reporting errors
 * in `feedbackErrorVWC`, and returning true on success / false on failure
 */
export const storeResponse = async ({
  responseVWC,
  trace,
  ctx,
  feedbackErrorVWC,
  journey,
}: {
  responseVWC: ValueWithCallbacks<number | null>;
  trace: (event: object) => any;
  ctx: ScreenContext;
  feedbackErrorVWC: WritableValueWithCallbacks<ReactElement | null>;
  journey: ScreenJourneyMapped;
}): Promise<boolean> => {
  const response = responseVWC.get();
  trace({
    type: 'store',
    response,
    responsePretty: makePrettyResponse(response),
  });

  if (response === null) {
    return true;
  }

  const loginContextUnch = ctx.login.value.get();
  if (loginContextUnch.state !== 'logged-in') {
    setVWC(feedbackErrorVWC, <>Not logged in</>);
    return false;
  }
  const loginContext = loginContextUnch;

  try {
    const resp = await apiFetch(
      '/api/1/journeys/feedback',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          journey_uid: journey.uid,
          journey_jwt: journey.jwt,
          version: 'oseh_jf-otp_sKjKVHs8wbI',
          response: response,
          feedback: null,
        }),
        keepalive: true,
      },
      loginContext
    );
    if (!resp.ok) {
      throw resp;
    }
    return true;
  } catch (e) {
    const desc = await describeError(e);
    setVWC(feedbackErrorVWC, desc);
    return false;
  }
};

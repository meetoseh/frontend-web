import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { ScreenContext } from '../../../hooks/useScreenContext';
import { ScreenJourneyMapped } from '../../../models/ScreenJourney';
import { makePrettyResponse } from './makePrettyResponse';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { chooseErrorFromStatus, DisplayableError } from '../../../../../shared/lib/errors';

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
  feedbackErrorVWC: WritableValueWithCallbacks<DisplayableError | null>;
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
    setVWC(
      feedbackErrorVWC,
      new DisplayableError('server-refresh-required', 'store feedback', 'not logged in')
    );
    return false;
  }
  const loginContext = loginContextUnch;

  try {
    let resp;
    try {
      resp = await apiFetch(
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
    } catch {
      throw new DisplayableError('connectivity', 'store feedback');
    }
    if (!resp.ok) {
      throw chooseErrorFromStatus(resp.status, 'store feedback');
    }
    return true;
  } catch (e) {
    const desc =
      e instanceof DisplayableError ? e : new DisplayableError('client', 'store feedback', `${e}`);
    setVWC(feedbackErrorVWC, desc);
    return false;
  }
};

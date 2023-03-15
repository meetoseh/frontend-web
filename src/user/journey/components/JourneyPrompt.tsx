import { MutableRefObject, ReactElement, useEffect, useState } from 'react';
import { convertUsingKeymap } from '../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../shared/ApiConstants';
import { describeError } from '../../../shared/forms/ErrorBlock';
import { LoginContextValue } from '../../../shared/LoginContext';
import { CountdownTextConfig } from '../../interactive_prompt/components/CountdownText';
import { InteractivePromptRouter } from '../../interactive_prompt/components/InteractivePromptRouter';
import {
  InteractivePrompt,
  interactivePromptKeyMap,
} from '../../interactive_prompt/models/InteractivePrompt';
import { JourneyRef } from '../models/JourneyRef';

type JourneyPromptProps = {
  /**
   * The journey to fetch the prompt for.
   */
  journey: JourneyRef;

  /**
   * The login context to use to fetch the prompt.
   */
  loginContext: LoginContextValue;

  /**
   * The function to call when the user has finished the prompt.
   */
  onFinished: () => void;

  /**
   * The ref to register a leaving callback which must be called before unmounting
   * the component normally in order to trigger a leave event. Otherwise, a leave
   * event is only triggered when the prompt finishes normally or the page is
   * closed (via onbeforeunload)
   */
  leavingCallback: MutableRefObject<(() => void) | null>;
};

const COUNTDOWN_CONFIG: CountdownTextConfig = {
  titleText: 'Class is almost ready',
};

/**
 * Loads the interactive prompt for a journey and then displays it.
 */
export const JourneyPrompt = ({
  journey,
  loginContext,
  onFinished,
  leavingCallback,
}: JourneyPromptProps): ReactElement => {
  const [interactivePrompt, setInteractivePrompt] = useState<InteractivePrompt | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    let active = true;
    setError(null);
    fetchPrompt().catch((e) => {
      if (active) {
        console.log('Error fetching prompt: ', e);
        describeError(e).then((errorElement) => {
          if (active) {
            setError(errorElement);
          }
        });
      }
    });
    return () => {
      active = false;
    };

    async function fetchPrompt() {
      const response = await apiFetch(
        '/api/1/journeys/start_interactive_prompt',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            journey_uid: journey.uid,
            journey_jwt: journey.jwt,
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const body = await response.json();
      const prompt = convertUsingKeymap(body, interactivePromptKeyMap);
      if (active) {
        setInteractivePrompt(prompt);
      }
    }
  }, [journey, loginContext]);

  if (interactivePrompt === null) {
    return error ?? <></>;
  }

  return (
    <InteractivePromptRouter
      prompt={interactivePrompt}
      onFinished={onFinished}
      countdown={COUNTDOWN_CONFIG}
      subtitle="Class Poll"
      leavingCallback={leavingCallback}
    />
  );
};

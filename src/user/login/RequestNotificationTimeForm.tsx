import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { apiFetch } from '../../shared/ApiConstants';
import { Button } from '../../shared/forms/Button';
import { useTimezone } from '../../shared/hooks/useTimezone';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { LoginContext } from '../../shared/LoginContext';
import { OsehImageFromState, OsehImageProps, useOsehImageState } from '../../shared/OsehImage';
import { InteractivePromptRouter } from '../interactive_prompt/components/InteractivePromptRouter';
import {
  InteractivePrompt,
  interactivePromptKeyMap,
} from '../interactive_prompt/models/InteractivePrompt';
import styles from './RequestNotificationTimeForm.module.css';

type RequestNotificationTimeFormProps = {
  setLoaded: (loaded: boolean) => void;
  onDone: () => void;
  showing: boolean;
};

/**
 * Shows a form where the user can select the time of day when they
 * want to receive notifications.
 */
export const RequestNotificationTimeForm = ({
  setLoaded,
  onDone,
  showing,
}: RequestNotificationTimeFormProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [prompt, setPrompt] = useState<InteractivePrompt | null>(null);
  const [answer, setAnswer] = useState<'morning' | 'afternoon' | 'evening' | 'any'>('any');
  const windowSize = useWindowSize();
  const timezone = useTimezone();
  const imageProps = useMemo<OsehImageProps>(
    () => ({
      uid: 'oseh_if_hH68hcmVBYHanoivLMgstg',
      jwt: null,
      isPublic: true,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
    }),
    [windowSize.width, windowSize.height]
  );
  const imageState = useOsehImageState(imageProps);

  useEffect(() => {
    if (loginContext.state !== 'logged-in' || prompt !== null) {
      return;
    }

    let active = true;
    fetchPrompt();
    return () => {
      active = false;
    };

    async function fetchPromptInner() {
      const response = await apiFetch(
        '/api/1/users/me/start_notification_time_prompt',
        {
          method: 'POST',
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const body = await response.json();
      const prompt = convertUsingKeymap(body, interactivePromptKeyMap);
      if (active) {
        setPrompt(prompt);
      }
    }

    async function fetchPrompt() {
      try {
        await fetchPromptInner();
      } catch (e) {
        if (active) {
          console.log('Error fetching prompt: ', e);
          onDone();
        }
      }
    }
  }, [loginContext, prompt, onDone]);

  useEffect(() => {
    const ready = prompt !== null && !imageState.loading;
    setLoaded(ready);
  }, [prompt, imageState.loading, setLoaded]);

  const onWordPromptResponse = useCallback((answer: string) => {
    if (answer === 'Morning') {
      setAnswer('morning');
    } else if (answer === 'Afternoon') {
      setAnswer('afternoon');
    } else if (answer === 'Evening') {
      setAnswer('evening');
    } else {
      console.log('Unexpected answer: ', answer);
    }
  }, []);

  const containerStyle = useMemo(() => {
    return {
      width: windowSize.width,
      height: windowSize.height,
    };
  }, [windowSize.width, windowSize.height]);

  const handleDone = useCallback(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    apiFetch(
      '/api/1/users/me/attributes/notification_time',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          notification_time: answer,
          timezone: timezone,
          timezone_technique: 'browser',
        }),
        keepalive: true,
      },
      loginContext
    );
    onDone();
  }, [loginContext, answer, timezone, onDone]);

  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.backgroundContainer}>
        <OsehImageFromState {...imageState} />
      </div>
      <div className={styles.contentContainer}>
        {prompt && (
          <InteractivePromptRouter
            prompt={prompt}
            onFinished={handleDone}
            onWordPromptResponse={onWordPromptResponse}
            paused={!showing}
          />
        )}
        <div className={styles.continueContainer}>
          <Button
            type="button"
            fullWidth
            variant={answer === 'any' ? 'link-white' : 'filled'}
            onClick={handleDone}>
            {answer === 'any' ? 'Skip' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { Button } from '../../shared/forms/Button';
import { usePublicInteractivePrompt } from '../../shared/hooks/usePublicInteractivePrompt';
import { useTimezone } from '../../shared/hooks/useTimezone';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { LoginContext } from '../../shared/LoginContext';
import { OsehImageFromState, OsehImageProps, useOsehImageState } from '../../shared/OsehImage';
import { InteractivePromptRouter } from '../interactive_prompt/components/InteractivePromptRouter';
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
  const publicPrompt = usePublicInteractivePrompt({ identifier: 'notification-time' });
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
  const leavingCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (publicPrompt.error !== null) {
      onDone();
    }
  }, [publicPrompt.error, onDone]);

  useEffect(() => {
    const ready = !publicPrompt.loading && !imageState.loading;
    setLoaded(ready);
  }, [publicPrompt, imageState.loading, setLoaded]);

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

  const handleSkip = useCallback(() => {
    leavingCallback.current?.();
    handleDone();
  }, [handleDone]);

  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.backgroundContainer}>
        <OsehImageFromState {...imageState} />
      </div>
      <div className={styles.contentContainer}>
        {publicPrompt.prompt !== null && (
          <InteractivePromptRouter
            prompt={publicPrompt.prompt}
            onFinished={handleDone}
            onWordPromptResponse={onWordPromptResponse}
            paused={!showing}
            leavingCallback={leavingCallback}
          />
        )}
        <div className={styles.continueContainer}>
          <Button
            type="button"
            fullWidth
            variant={answer === 'any' ? 'link-white' : 'filled'}
            onClick={handleSkip}>
            {answer === 'any' ? 'Skip' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

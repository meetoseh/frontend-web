import { FeatureComponentProps } from '../../models/Feature';
import styles from './RequestNotificationTime.module.css';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import { InteractivePromptRouter } from '../../../interactive_prompt/components/InteractivePromptRouter';
import { useCallback, useContext, useRef } from 'react';
import { Button } from '../../../../shared/forms/Button';
import { RequestNotificationTimeState } from './RequestNotificationTimeState';
import { RequestNotificationTimeResources } from './RequestNotificationTimeResources';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { useTimezone } from '../../../../shared/hooks/useTimezone';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { InteractiveWordPrompt } from '../../../interactive_prompt/models/InteractivePrompt';

/**
 * Asks the user to consider how they are feeling
 */
export const RequestNotificationTime = ({
  state,
  resources,
}: FeatureComponentProps<RequestNotificationTimeState, RequestNotificationTimeResources>) => {
  const loginContext = useContext(LoginContext);
  const timezone = useTimezone();
  const leavingCallback = useRef<(() => void) | null>(null);
  const responseRef = useRef<string | null>(null);
  useStartSession({
    type: 'callbacks',
    props: () => resources.get().session,
    callbacks: resources.callbacks,
  });

  const onWordPromptResponse = useCallback((response: string | null) => {
    responseRef.current = response;
  }, []);

  const onFinish = useCallback(
    (privileged: boolean) => {
      apiFetch(
        '/api/1/users/me/attributes/notification_time',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            notification_time: responseRef.current?.toLowerCase() ?? 'any',
            timezone: timezone,
            timezone_technique: 'browser',
          }),
          keepalive: true,
        },
        loginContext
      );
      resources.get().session?.reset?.call(undefined);

      leavingCallback?.current?.();
      state.get().ian?.onShown?.call(undefined);
    },
    [state, resources, timezone, loginContext]
  );

  const onErrorButtonPress = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onFinish(true);
    },
    [onFinish]
  );

  return (
    <RenderGuardedComponent
      props={resources}
      component={(resources) => {
        if (resources.prompt === null || resources.prompt.loading) {
          return <></>;
        }

        return (
          <div className={styles.container}>
            <div className={styles.imageContainer}>
              <OsehImageFromState {...resources.background} />
            </div>
            <div className={styles.content}>
              {resources.prompt.error !== null && <ErrorBlock>{resources.prompt.error}</ErrorBlock>}
              {resources.prompt.prompt !== null ? (
                <InteractivePromptRouter
                  prompt={resources.prompt.prompt as InteractiveWordPrompt}
                  onResponse={onWordPromptResponse}
                  onFinished={onFinish}
                  finishEarly
                  leavingCallback={leavingCallback}
                  titleMaxWidth={350}
                />
              ) : (
                <>
                  <ErrorBlock>There was an error loading this prompt.</ErrorBlock>
                  <div>
                    <Button type="button" onClick={onErrorButtonPress} variant="filled" fullWidth>
                      Continue
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      }}
    />
  );
};

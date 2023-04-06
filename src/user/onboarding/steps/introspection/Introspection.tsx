import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import styles from './Introspection.module.css';
import { OsehImageFromState } from '../../../../shared/OsehImage';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import { InteractivePromptRouter } from '../../../interactive_prompt/components/InteractivePromptRouter';
import { useCallback, useRef } from 'react';
import { Button } from '../../../../shared/forms/Button';
import { IntrospectionState } from './IntrospectionState';
import { IntrospectionResources } from './IntrospectionResources';

/**
 * Asks the user to consider how they are feeling
 */
export const Introspection = ({
  state,
  resources,
  doAnticipateState,
}: OnboardingStepComponentProps<IntrospectionState, IntrospectionResources>) => {
  const leavingCallback = useRef<(() => void) | null>(null);
  const responseRef = useRef<string | null>(null);

  const onWordPromptResponse = useCallback((response: string) => {
    responseRef.current = response;
  }, []);

  const onFinish = useCallback(
    (privileged: boolean) => {
      leavingCallback?.current?.();
      const newState = state.onContinue(responseRef.current);
      if (privileged) {
        doAnticipateState(newState, Promise.resolve());
      }
    },
    [doAnticipateState, state]
  );

  const onErrorButtonPress = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onFinish(true);
    },
    [onFinish]
  );

  if (resources.background === null || resources.prompt === null || resources.prompt.loading) {
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
            prompt={resources.prompt.prompt}
            onWordPromptResponse={onWordPromptResponse}
            onFinished={onFinish}
            finishEarly
            leavingCallback={leavingCallback}
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
};

import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import { DailyGoalResources } from './DailyGoalResources';
import { DailyGoalState } from './DailyGoalState';
import styles from './DailyGoal.module.css';
import { OsehImageFromState } from '../../../../shared/OsehImage';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import { InteractivePromptRouter } from '../../../interactive_prompt/components/InteractivePromptRouter';
import { useCallback, useRef } from 'react';
import { Button } from '../../../../shared/forms/Button';

const finishEarlySettings = { cta: 'Enter Class' };

/**
 * Asks the user for their daily goal
 */
export const DailyGoal = ({
  state,
  resources,
  doAnticipateState,
}: OnboardingStepComponentProps<DailyGoalState, DailyGoalResources>) => {
  const leavingCallback = useRef<(() => void) | null>(null);
  const responseRef = useRef<string | null>(null);

  const onWordPromptResponse = useCallback(
    (response: string) => {
      responseRef.current = response;
      state.onSelection.call(undefined, response);
    },
    [state.onSelection]
  );

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
            finishEarly={finishEarlySettings}
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

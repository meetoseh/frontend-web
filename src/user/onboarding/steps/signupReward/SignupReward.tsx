import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import { SignupRewardResources } from './SignupRewardResources';
import styles from './SignupReward.module.css';
import { OsehImageFromState } from '../../../../shared/OsehImage';
import { DidYouKnow } from '../../../../shared/components/DidYouKnow';
import { useCallback } from 'react';
import { Button } from '../../../../shared/forms/Button';
import { SignupRewardState } from './SignupRewardState';

/**
 * Rewards the user for completing signup.
 */
export const SignupReward = ({
  state,
  resources,
  doAnticipateState,
}: OnboardingStepComponentProps<SignupRewardState, SignupRewardResources>) => {
  const onFinish = useCallback(() => {
    const newState = state.onContinue();
    doAnticipateState(newState, Promise.resolve());
  }, [doAnticipateState, state]);

  if (resources.background === null) {
    return <></>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...resources.background} />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>
          <div className={styles.line1}>
            High-five{resources.givenName !== null ? ', ' + resources.givenName : ''}!
          </div>
          <div className={styles.line2}>
            You&rsquo;re on your way to making mindfulness a daily habit.
          </div>
        </div>
        <DidYouKnow animation={{ delay: 750 }}>
          Meditation enhances creativity and innovation by reducing your stress hormone.
        </DidYouKnow>
        <div className={styles.submitContainer}>
          <Button type="button" fullWidth onClick={onFinish}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

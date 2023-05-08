import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import { SignupRewardResources } from './SignupRewardResources';
import styles from './SignupReward.module.css';
import { OsehImageFromState } from '../../../../shared/OsehImage';
import { useCallback } from 'react';
import { Button } from '../../../../shared/forms/Button';
import { SignupRewardState } from './SignupRewardState';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';

/**
 * Rewards the user for completing signup.
 */
export const SignupReward = ({
  state,
  resources,
  doAnticipateState,
}: OnboardingStepComponentProps<SignupRewardState, SignupRewardResources>) => {
  useStartSession(resources.session);
  const windowSize = useWindowSize();

  const onFinish = useCallback(() => {
    resources.session?.storeAction?.call(undefined, 'next', null);
    resources.session?.reset?.call(undefined);
    const newState = {
      ...state,
      signupIAP: state.signupIAP?.onShown?.call(undefined) ?? null,
    };

    doAnticipateState(newState, Promise.resolve());
  }, [doAnticipateState, state, resources.session]);

  if (resources.image === null) {
    return <></>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <div
          className={styles.background}
          style={{ width: windowSize.width, height: windowSize.height }}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>
          We are here to help you feel your best&#8212;<em>everyday</em>
        </div>
        <div className={styles.horizontalRule} />
        <div className={styles.checkList}>
          <div className={styles.checkListItem}>Classes for every mood</div>
          <div className={styles.checkListItem}>Daily check-ins</div>
          <div className={styles.checkListItem}>Bite-sized to fit your schedule</div>
        </div>
        <div className={styles.bannerContainer}>
          <OsehImageFromState {...resources.image} />
        </div>
        <div className={styles.submitOuterContainer}>
          <div className={styles.submitContainer}>
            <Button type="button" variant="filled-white" fullWidth onClick={onFinish}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

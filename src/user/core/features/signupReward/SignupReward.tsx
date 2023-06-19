import { FeatureComponentProps } from '../../models/Feature';
import { SignupRewardResources } from './SignupRewardResources';
import styles from './SignupReward.module.css';
import { useCallback, useContext } from 'react';
import { Button } from '../../../../shared/forms/Button';
import { SignupRewardState } from './SignupRewardState';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { InterestsContext } from '../../../../shared/contexts/InterestsContext';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';

/**
 * Rewards the user for completing signup.
 */
export const SignupReward = ({
  state,
  resources,
  doAnticipateState,
}: FeatureComponentProps<SignupRewardState, SignupRewardResources>) => {
  const interests = useContext(InterestsContext);
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
          {(() => {
            const defaultCopy = (
              <>
                We are here to help you feel your best&#8212;<em>everyday</em>
              </>
            );

            if (interests.state !== 'loaded') {
              return defaultCopy;
            } else if (interests.primaryInterest === 'sleep') {
              return (
                <>
                  We are here to help you sleep&#8212;<em>everyday</em>
                </>
              );
            } else {
              return defaultCopy;
            }
          })()}
        </div>
        <div className={styles.horizontalRule} />
        <div className={styles.checkList}>
          <div className={styles.checkListItem}>
            {(() => {
              const defaultCopy = <>Classes for every mood</>;

              if (interests.state !== 'loaded') {
                return defaultCopy;
              } else if (interests.primaryInterest === 'anxiety') {
                return <>Variety of unique themes</>;
              } else if (interests.primaryInterest === 'sleep') {
                return <>Classes to induce any dream</>;
              } else {
                return defaultCopy;
              }
            })()}
          </div>
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

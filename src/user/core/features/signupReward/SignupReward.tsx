import { FeatureComponentProps } from '../../models/Feature';
import { SignupRewardResources } from './SignupRewardResources';
import styles from './SignupReward.module.css';
import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Button } from '../../../../shared/forms/Button';
import { SignupRewardState } from './SignupRewardState';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import {
  InterestsContext,
  InterestsContextValue,
} from '../../../../shared/contexts/InterestsContext';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';

/**
 * Rewards the user for completing signup.
 */
export const SignupReward = ({
  state,
  resources,
}: FeatureComponentProps<SignupRewardState, SignupRewardResources>) => {
  const interests = useContext(InterestsContext);
  useStartSession({
    type: 'callbacks',
    props: () => resources.get().session,
    callbacks: resources.callbacks,
  });
  const windowSize = useWindowSize();

  const sentCustomizationEventRef = useRef<boolean>(false);
  useEffect(() => {
    if (sentCustomizationEventRef.current || interests.state !== 'loaded') {
      return;
    }
    sentCustomizationEventRef.current = true;
    resources.get().session?.storeAction('customized', { interest: interests.primaryInterest });
  }, [interests, resources]);

  const onFinish = useCallback(() => {
    resources.get().session?.storeAction?.call(undefined, 'next', null);
    resources.get().session?.reset?.call(undefined);
    state.get().ian?.onShown?.call(undefined);
  }, [state, resources]);

  const checklistItems = useMemo((): ReactElement[] => getChecklistItems(interests), [interests]);
  const title = useMemo((): ReactElement => getTitle(interests), [interests]);

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <div
          className={styles.background}
          style={{ width: windowSize.width, height: windowSize.height }}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.horizontalRule} />
        <div className={styles.checkList}>
          {checklistItems.map((item, i) => (
            <div key={i} className={styles.checkListItem}>
              {item}
            </div>
          ))}
        </div>
        <div className={styles.bannerContainer}>
          <OsehImageFromStateValueWithCallbacks
            state={useMappedValueWithCallbacks(resources, (r) => r.image)}
          />
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

const getTitle = (interests: InterestsContextValue): ReactElement => {
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
};

const getChecklistItems = (interests: InterestsContextValue): ReactElement[] => {
  const result = [
    <>Classes for every mood</>,
    <>Daily check-ins</>,
    <>Bite-sized to fit your schedule</>,
  ];

  if (interests.state !== 'loaded') {
    return result;
  }

  if (interests.primaryInterest === 'anxiety') {
    result[0] = <>Variety of unique themes</>;
  } else if (interests.primaryInterest === 'sleep') {
    result[0] = <>Classes to induce any dream</>;
  } else if (interests.primaryInterest === 'isaiah-course') {
    result[0] = <>Access to Isaiah&rsquo;s Course</>;
    result[1] = <>100s of other classes for any mood</>;
    result[2] = <>Reminders to keep you motivated</>;
  }
  return result;
};

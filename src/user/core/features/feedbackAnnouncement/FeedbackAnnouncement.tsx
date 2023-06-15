import { ReactElement, useCallback } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { FeedbackAnnouncementResources } from './FeedbackAnnouncementResources';
import { FeedbackAnnouncementState } from './FeedbackAnnouncementState';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { SplashScreen } from '../../../splash/SplashScreen';
import styles from './FeedbackAnnouncement.module.css';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { Button } from '../../../../shared/forms/Button';
import { OsehImageFromState } from '../../../../shared/OsehImage';

/**
 * Shows the announcement for the new feedback feature
 */
export const FeedbackAnnouncment = ({
  state,
  resources,
  doAnticipateState,
}: FeatureComponentProps<
  FeedbackAnnouncementState,
  FeedbackAnnouncementResources
>): ReactElement => {
  const windowSize = useWindowSize();
  useStartSession(resources.session);

  const onNext = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.session?.storeAction('next', null);
      resources.session?.reset();
      doAnticipateState(
        { ...state, ian: state.ian === null ? null : state.ian.onShown(false) },
        Promise.resolve()
      );
    },
    [state, resources.session, doAnticipateState]
  );

  if (resources.image === null) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <div className={styles.background} style={windowSize} />
      </div>
      <div className={styles.content}>
        <div className={styles.locator}>
          <div className={styles.locatorDot} />
          <div className={styles.locatorText}>Introducing Oseh 2.2</div>
        </div>
        <div className={styles.title}>Classes just for you</div>
        <div className={styles.horizontalRule} />
        <div className={styles.info}>
          More of what you love, all of the time. Share how you liked a class and we&rsquo;ll curate
          your next class, just for you.
        </div>
        <div className={styles.contentImageContainer}>
          <div className={styles.contentImageOverlay} />
          <OsehImageFromState {...resources.image} />
        </div>
        <div className={styles.submitOuterContainer}>
          <div className={styles.submitContainer}>
            <Button type="button" variant="filled-white" fullWidth onClick={onNext}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

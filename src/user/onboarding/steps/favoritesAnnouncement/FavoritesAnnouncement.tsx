import { ReactElement, useCallback } from 'react';
import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import { FavoritesAnnouncementResources } from './FavoritesAnnouncementResources';
import { FavoritesAnnouncementState } from './FavoritesAnnouncementState';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { SplashScreen } from '../../../splash/SplashScreen';
import styles from './FavoritesAnnouncement.module.css';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { Button } from '../../../../shared/forms/Button';
import { OsehImageFromState } from '../../../../shared/OsehImage';

/**
 * Shows the announcement for the new favorites feature
 */
export const FavoritesAnnouncement = ({
  state,
  resources,
  doAnticipateState,
}: OnboardingStepComponentProps<
  FavoritesAnnouncementState,
  FavoritesAnnouncementResources
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
          <div className={styles.locatorText}>Feature Announcement</div>
        </div>
        <div className={styles.title}>
          Introducing <em>favorites</em>
        </div>
        <div className={styles.horizontalRule} />
        <div className={styles.info}>
          All of your favorite classes, all of the time. Save and listen to any class on-demand.
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

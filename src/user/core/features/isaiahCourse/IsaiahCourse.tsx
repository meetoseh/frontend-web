import { ReactElement, useCallback } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { IsaiahCourseResources } from './IsaiahCourseResources';
import { IsaiahCourseState } from './IsaiahCourseState';
import styles from './IsaiahCourse.module.css';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { Button } from '../../../../shared/forms/Button';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';

/**
 * Directs the user to their purchases page to start the isaiah course.
 */
export const IsaiahCourse = ({
  state: stateVWC,
  resources: resourcesVWC,
}: FeatureComponentProps<IsaiahCourseState, IsaiahCourseResources>): ReactElement => {
  useStartSession(
    adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(resourcesVWC, (r) => r.session)
    )
  );

  const handleLetsGo = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      resourcesVWC.get().session?.storeAction?.call(undefined, 'lets_go', null);
      resourcesVWC.get().session?.reset?.call(undefined);
      stateVWC.get().ian?.onShown?.call(undefined);
      resourcesVWC.get().gotoPurchases();
    },
    [resourcesVWC, stateVWC]
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(resourcesVWC, (r) => r.background)}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.brandmarkContainer}>
          <div className={styles.brandmarkIcon} />
        </div>
        <div className={styles.title}>Check out your new course from Isaiah Quinn!</div>
        <div className={styles.subtitle}>Your new course is ready for you.</div>
        <div className={styles.description}>
          <p>
            You can access it anytime from your &lsquo;favorites&rsquo; section, accessible from the
            Home Screen.
          </p>
        </div>
        <div className={styles.gotoFavoritesButton}>
          <Button type="button" variant="filled-white" onClick={handleLetsGo} fullWidth>
            Let&rsquo;s Go
          </Button>
        </div>
      </div>
    </div>
  );
};

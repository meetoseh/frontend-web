import { Journey } from './Journey';
import styles from './CompactJourney.module.css';
import { OsehImage } from '../../shared/images/OsehImage';
import { ReactElement, useContext, useState, useCallback } from 'react';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

type CompactJourneyProps = {
  /**
   * The journey to show
   */
  journey: Journey;

  /**
   * If set to true, this component will fetch and include how many views the journey
   * has
   */
  showViews?: boolean;

  /**
   * The handler for fetching images
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Shows a journey in a very compact, non-block format. This typically renders as a single
 * line if given at least 250px of width, and is 90px tall in that case.
 */
export const CompactJourney = ({
  journey,
  showViews,
  imageHandler,
}: CompactJourneyProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [views, setViews] = useState<{ journeyUid: string; count: number } | undefined>(undefined);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (
          !showViews ||
          views?.journeyUid === journey.uid ||
          loginContextUnch.state !== 'logged-in'
        ) {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchViews();
        return () => {
          active = false;
        };

        async function fetchViews() {
          const response = await apiFetch(
            '/api/1/admin/journey_views?' +
              new URLSearchParams({ journey_uid: journey.uid }).toString(),
            {
              method: 'GET',
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          if (active) {
            setViews({
              journeyUid: journey.uid,
              count: data.views,
            });
          }
        }
      },
      [journey.uid, showViews, views]
    )
  );

  return (
    <div className={styles.container}>
      <div className={styles.journeyIconContainer}>
        <OsehImage
          uid={journey.backgroundImage.uid}
          jwt={journey.backgroundImage.jwt}
          displayWidth={45}
          displayHeight={90}
          alt=""
          handler={imageHandler}
        />
      </div>
      <div className={styles.right}>
        {journey.deletedAt !== null && (
          <div className={styles.rightRow}>
            <div className={styles.deletedNote}>Deleted</div>
          </div>
        )}
        <div className={styles.rightRow}>
          <div className={styles.journeyTitleContainer}>{journey.title}</div>
          <div className={styles.journeyByContainer}>by</div>
          <div className={styles.journeyInstructorContainer}>
            {journey.instructor.picture && (
              <div className={styles.journeyInstructorIconContainer}>
                <OsehImage
                  uid={journey.instructor.picture.uid}
                  jwt={journey.instructor.picture.jwt}
                  displayWidth={45}
                  displayHeight={45}
                  alt={journey.instructor.name}
                  handler={imageHandler}
                />
              </div>
            )}

            <div className={styles.journeyInstructorNameContainer}>{journey.instructor.name}</div>

            {views?.journeyUid === journey.uid && (
              <div className={styles.journeyViewsContainer}>
                {views.count} {views.count === 1 ? 'view' : 'views'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImageFromState, useOsehImageState } from '../../shared/OsehImage';
import { JourneyRef } from '../journey/models/JourneyRef';
import { DailyEvent, DailyEventJourney } from './DailyEvent';
import styles from './NewDailyEventView.module.css';

type DailyEventViewProps = {
  /**
   * The event this is a view for
   */
  event: DailyEvent;

  /**
   * Called when we're loading resources to show the daily event, or
   * we're done loading. Can be used to display a splash screen rather
   * than placeholders
   *
   * @param loading True if we're loading, false otherwise
   */
  setLoading: (this: void, loading: boolean) => void;

  /**
   * Called when we receive a ref to the journey that the user should be directed
   * to
   *
   * @param journey The journey that the user should be directed to
   */
  setJourney: (this: void, journey: JourneyRef) => void;
};

/**
 * Shows the specified daily event and allows the user to take actions as
 * appropriate for the indicated access level
 */
export const DailyEventView = ({
  event,
  setLoading,
  setJourney,
}: DailyEventViewProps): ReactElement => {
  const [loadingJourneyUids, setLoadingJourneyUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Only journey uids that are in the event can be loading
    setLoadingJourneyUids((u) => {
      const journeyUids = new Set(event.journeys.map((j) => j.uid));
      const newSet = new Set(u);

      u.forEach((val) => {
        if (!journeyUids.has(val)) {
          newSet.delete(val);
        }
      });

      return newSet;
    });
  }, [event.journeys]);

  const cards = useMemo(() => {
    return event.journeys.map((j) => {
      return (
        <DailyEventJourneyCard
          journey={j}
          setLoading={(loading, uid) => {
            if (loading) {
              setLoadingJourneyUids((u) => {
                const result = new Set(u);
                result.add(uid);
                return result;
              });
            } else {
              setLoadingJourneyUids((u) => {
                const result = new Set(u);
                result.delete(uid);
                return result;
              });
            }
          }}
        />
      );
    });
  }, [event.journeys]);

  useEffect(() => {
    setLoading(loadingJourneyUids.size > 0);
  }, [setLoading, loadingJourneyUids.size]);

  return <>{cards}</>;
};

type DailyEventJourneyCardProps = {
  journey: DailyEventJourney;

  setLoading: (this: void, loading: boolean, uid: string) => void;
};

/**
 * Shows a single journey within a daily event
 */
const DailyEventJourneyCard = ({
  journey,
  setLoading,
}: DailyEventJourneyCardProps): ReactElement => {
  const windowSize = useWindowSize();
  const background = useOsehImageState({
    uid: journey.backgroundImage.uid,
    jwt: journey.backgroundImage.jwt,
    displayWidth: windowSize.width,
    displayHeight: windowSize.height,
    alt: '',
  });

  useEffect(() => {
    setLoading(background.loading, journey.uid);
  }, [setLoading, journey.uid, background.loading]);

  return (
    <div className={styles.journeyCardContainer}>
      <div className={styles.journeyCardImageContainer}>
        <OsehImageFromState {...background} />
      </div>
    </div>
  );
};

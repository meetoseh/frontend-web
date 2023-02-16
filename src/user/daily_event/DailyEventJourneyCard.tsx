import { ReactElement } from 'react';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { OsehImageFromState, OsehImageState } from '../../shared/OsehImage';
import { DailyEventJourney } from './DailyEvent';
import styles from './DailyEventJourneyCard.module.css';

type DailyEventJourneyCardState = {
  /**
   * The journey that is being shown
   */
  journey: DailyEventJourney;

  /**
   * The size of the window we're displayed in
   */
  windowSize: { width: number; height: number };

  /**
   * The background image state
   */
  background: OsehImageState;
};

/**
 * Shows a single journey within a daily event; this has no side-effects so
 * that it can be rendered instantly without a flash of white. Hence anything
 * showing these cards is extremely coupled to this components implementation
 */
export const DailyEventJourneyCard = ({
  journey,
  windowSize,
  background,
}: DailyEventJourneyCardState): ReactElement => {
  const containerStyle = useFullHeightStyle({ attribute: 'height', windowSize });

  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.content}>
        <div className={styles.header}></div>
        <div className={styles.body}>
          <div className={styles.title}>{journey.title}</div>
          <div className={styles.instructor}>{journey.instructor.name}</div>
          <div className={styles.description}>{journey.description.text}</div>
        </div>
      </div>
    </div>
  );
};

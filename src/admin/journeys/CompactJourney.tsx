import { Journey } from './Journey';
import styles from './CompactJourney.module.css';
import { OsehImage } from '../../shared/OsehImage';
import { ReactElement } from 'react';

type CompactJourneyProps = {
  /**
   * The journey to show
   */
  journey: Journey;
};

/**
 * Shows a journey in a very compact, non-block format. This typically renders as a single
 * line if given at least 250px of width, and is 90px tall in that case.
 */
export const CompactJourney = ({ journey }: CompactJourneyProps): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.journeyIconContainer}>
        <OsehImage
          uid={journey.backgroundImage.uid}
          jwt={journey.backgroundImage.jwt}
          displayWidth={45}
          displayHeight={90}
          alt=""
        />
      </div>
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
            />
          </div>
        )}

        <div className={styles.journeyInstructorNameContainer}>{journey.instructor.name}</div>
      </div>
    </div>
  );
};

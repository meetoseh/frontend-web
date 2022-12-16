import { ReactElement, useEffect, useState } from 'react';
import { OsehContent } from '../../shared/OsehContent';
import { OsehImage } from '../../shared/OsehImage';
import { CrudFormElement } from '../crud/CrudFormElement';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { Journey } from './Journey';
import styles from './JourneyBlock.module.css';

type JourneyBlockProps = {
  /**
   * The journey to display
   */
  journey: Journey;

  /**
   * Used to update the journey after a confirmation from the server
   */
  setJourney: (this: void, journey: Journey) => void;
};

/**
 * Shows a journey and allows editing it, including soft-deleting
 */
export const JourneyBlock = ({ journey, setJourney }: JourneyBlockProps): ReactElement => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);

    let timeout: NodeJS.Timeout | null = null;
    const onResize = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(handleResize, 100);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <CrudItemBlock title={journey.title} controls={null}>
      <div className={styles.container}>
        <CrudFormElement title="Audio Content">
          <div className={styles.audioContentContainer}>
            <OsehContent uid={journey.audioContent.uid} jwt={journey.audioContent.jwt} />
          </div>
        </CrudFormElement>
        <CrudFormElement title="Background Image">
          <div className={styles.backgroundImageContainer}>
            <OsehImage
              uid={journey.backgroundImage.uid}
              jwt={journey.backgroundImage.jwt}
              displayWidth={isMobile ? 180 : 480}
              displayHeight={isMobile ? 368 : 270}
              alt="Background"
            />
          </div>
        </CrudFormElement>
        <CrudFormElement title="Categorization">
          {journey.subcategory.internalName} (displayed as {journey.subcategory.externalName})
        </CrudFormElement>

        <CrudFormElement title="Instructor">
          <div className={styles.instructorContainer}>
            {journey.instructor.picture && (
              <div className={styles.instructorPictureContainer}>
                <OsehImage
                  uid={journey.instructor.picture.uid}
                  jwt={journey.instructor.picture.jwt}
                  displayWidth={60}
                  displayHeight={60}
                  alt="Instructor"
                />
              </div>
            )}
            <div className={styles.instructorNameContainer}>{journey.instructor.name}</div>
          </div>
        </CrudFormElement>

        <CrudFormElement title="Description">{journey.description}</CrudFormElement>

        <CrudFormElement title="Prompt">
          <div className={styles.promptContainer}>
            <pre>
              <code>{JSON.stringify(journey.prompt, undefined, 2)}</code>
            </pre>
          </div>
        </CrudFormElement>

        <CrudFormElement title="UID">
          <div className={styles.uidContainer}>
            <pre>{journey.uid}</pre>
          </div>
        </CrudFormElement>
      </div>
    </CrudItemBlock>
  );
};

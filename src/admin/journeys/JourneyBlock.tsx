import { ReactElement } from 'react';
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
  return (
    <CrudItemBlock title={journey.title} controls={null}>
      <div className={styles.container}>Journey</div>
    </CrudItemBlock>
  );
};

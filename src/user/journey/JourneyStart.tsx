import { ReactElement, useCallback, useRef } from 'react';
import { useFullHeight } from '../../shared/hooks/useFullHeight';
import { JourneyAndJourneyStartShared, JourneyRef } from './JourneyAndJourneyStartShared';
import styles from './JourneyStart.module.css';

type JourneyStartProps = {
  /**
   * The journey the user will be starting
   */
  journey: JourneyRef;

  /**
   * Shared state between us and the journey to reduce the number of
   * redundant requests
   */
  shared: JourneyAndJourneyStartShared;

  /**
   * The function to call when the user wants to start the journey. This
   * will exclusively be called from a privileged context, i.e., immediately
   * after a user interaction.
   */
  onStart: () => void;
};

/**
 * Shows a screen allowing the user to perform an interaction to start the
 * journey, as well as potentially other social actions.
 *
 * This is useful for elevating to a privileged context, which is required
 * for starting the journey audio.
 */
export const JourneyStart = ({ journey, shared, onStart }: JourneyStartProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  const onButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onStart();
    },
    [onStart]
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>{shared.image}</div>

      <div className={styles.innerContainer}>
        <div className={styles.content}>
          <div className={styles.skipForNowContainer}>
            <button type="button" className={styles.button} onClick={onButtonClick}>
              Begin Practice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

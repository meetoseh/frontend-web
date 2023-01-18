import { ReactElement } from 'react';
import { JourneyRef } from './Journey';

type JourneyStartProps = {
  /**
   * The journey the user will be starting
   */
  journey: JourneyRef;

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
export const JourneyStart = ({ journey, onStart }: JourneyStartProps): ReactElement => {
  return (
    <div>
      journey start {journey.uid}:{' '}
      <button type="button" onClick={onStart}>
        Start
      </button>
    </div>
  );
};

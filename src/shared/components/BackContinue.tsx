import { ReactElement } from 'react';
import styles from './BackContinue.module.css';
import { Button } from '../forms/Button';

export type BackContinueProps = {
  /** Handler for when the back button is pressed, or null for no back button */
  onBack: (() => void) | null;
  /** Handler for when the continue button is pressed */
  onContinue: () => void;
};

/**
 * Intended as a full-width component for the bottom of the screen, shows either
 * a continue button or a back button and continue button. Useful for sequential
 * screens, especially in onboarding (e.g., goal categories, age range, etc)
 */
export const BackContinue = ({ onBack, onContinue }: BackContinueProps): ReactElement => {
  if (onBack === null) {
    return (
      <Button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onContinue();
        }}
        variant="filled-white"
        fullWidth>
        Continue
      </Button>
    );
  }

  return (
    <div className={styles.container}>
      <Button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onBack();
        }}
        variant="outlined-white"
        fullWidth>
        Back
      </Button>
      <Button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onContinue();
        }}
        variant="filled-white"
        fullWidth>
        Continue
      </Button>
    </div>
  );
};

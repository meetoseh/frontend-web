import { ReactElement } from 'react';
import styles from './BackContinue.module.css';
import { Button } from '../forms/Button';

export type BackContinueProps = {
  /** Handler for when the back button is pressed, or null for no back button */
  onBack: (() => void) | null;
  /** Handler for when the continue button is pressed */
  onContinue: () => void;

  /** Overrides the text for the back button */
  backText?: string;

  /** Overrides the text for the continue button */
  continueText?: string;
};

/**
 * Intended as a full-width component for the bottom of the screen, shows either
 * a continue button or a back button and continue button. Useful for sequential
 * screens, especially in onboarding (e.g., goal categories, age range, etc)
 */
export const BackContinue = ({
  onBack,
  onContinue,
  backText,
  continueText,
}: BackContinueProps): ReactElement => {
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
        {continueText ?? 'Continue'}
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
        {backText ?? 'Back'}
      </Button>
      <Button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onContinue();
        }}
        variant="filled-white"
        fullWidth>
        {continueText ?? 'Continue'}
      </Button>
    </div>
  );
};

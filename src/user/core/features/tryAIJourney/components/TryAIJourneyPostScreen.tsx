import { useCallback, useState } from 'react';
import { OsehImageFromState } from '../../../../../shared/images/OsehImageFromState';
import { IconButton } from '../../../../../shared/forms/IconButton';
import { SplashScreen } from '../../../../splash/SplashScreen';
import { TryAIJourneyResources } from '../TryAIJourneyResources';
import { TryAIJourneyState } from '../TryAIJourneyState';
import styles from './TryAIJourneyPostScreen.module.css';
import { Button } from '../../../../../shared/forms/Button';
import { combineClasses } from '../../../../../shared/lib/combineClasses';

type TryAIJourneyPromptProps = {
  /**
   * The state we used to determine if we should show the prompt.
   */
  state: TryAIJourneyState;
  /**
   * The resources required to render the prompt.
   */
  resources: TryAIJourneyResources;
  /**
   * The callback for if the user indicates they liked the journey.
   */
  onThumbsUp: () => void;
  /**
   * The callback for if the user indicates they didn't like the journey.
   */
  onThumbsDown: () => void;
  /**
   * The callback for if the user closes the prompt with the X button
   */
  onClose: () => void;
  /**
   * The callback for if the user clicks the continue button.
   */
  onContinue: () => void;
};

/**
 * The post-screen that is swapped in when a user takes an ai-generated
 * journey via the ai-generated journey prompt
 */
export const TryAIJourneyPostScreen = ({
  state,
  resources,
  onThumbsUp,
  onThumbsDown,
  onClose,
  onContinue,
}: TryAIJourneyPromptProps) => {
  const [review, setReview] = useState<'up' | 'down' | null>(null);

  const handleThumbsUp = useCallback(() => {
    setReview('up');
    onThumbsUp();
  }, [onThumbsUp]);

  const handleThumbsDown = useCallback(() => {
    setReview('down');
    onThumbsDown();
  }, [onThumbsDown]);

  if (resources.loading || resources.promptBackground === null) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...resources.promptBackground} />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>How did that feel?</div>
        <div className={styles.description}>
          Say more about your experience via email to <a href="mailto:hi@oseh.com">hi@oseh.com</a>
        </div>
        <div className={styles.buttonsContainer}>
          <IconButton
            icon={combineClasses(
              styles.reviewUp,
              review === 'up' ? styles.pressed : styles.notPressed
            )}
            srOnlyName="Thumbs Up"
            onClick={handleThumbsUp}
          />
          <IconButton
            icon={combineClasses(
              styles.reviewDown,
              review === 'down' ? styles.pressed : styles.notPressed
            )}
            srOnlyName="Thumbs Down"
            onClick={handleThumbsDown}
          />
        </div>
        <div className={styles.continueContainer}>
          <Button
            type="button"
            variant={review === null ? 'link-white' : 'filled-white'}
            onClick={onContinue}
            fullWidth>
            Continue
          </Button>
        </div>
      </div>
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onClose} />
        </div>
      </div>
    </div>
  );
};

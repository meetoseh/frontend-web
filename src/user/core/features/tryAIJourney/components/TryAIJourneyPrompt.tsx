import { OsehImageFromState } from '../../../../../shared/OsehImage';
import { SplashScreen } from '../../../../splash/SplashScreen';
import { TryAIJourneyResources } from '../TryAIJourneyResources';
import { TryAIJourneyState } from '../TryAIJourneyState';
import styles from './TryAIJourneyPrompt.module.css';
import { IconButton } from '../../../../../shared/forms/IconButton';
import { Button } from '../../../../../shared/forms/Button';

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
   * The callback for if the user says yes.
   */
  onYes: () => void;
  /**
   * The callback for if the user says no.
   */
  onNo: () => void;
  /**
   * The callback for if the user closes the prompt with the
   * X button.
   */
  onClose: () => void;
};

export const TryAIJourneyPrompt = ({
  state,
  resources,
  onYes,
  onNo,
  onClose,
}: TryAIJourneyPromptProps) => {
  if (resources.loading || resources.promptBackground === null) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...resources.promptBackground} />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>We&rsquo;re working on something new</div>
        <div className={styles.description}>
          Try an AI generated class, then let us know{' '}
          <span style={{ whiteSpace: 'nowrap' }}>what you think.</span>
        </div>
        <div className={styles.buttonsContainer}>
          <Button type="button" variant="filled-white" onClick={onYes} fullWidth>
            Take Me To Class
          </Button>
          <Button type="button" variant="link-white" onClick={onNo} fullWidth>
            No Thanks
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

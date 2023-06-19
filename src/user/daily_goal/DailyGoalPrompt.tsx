import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { usePublicInteractivePrompt } from '../../shared/hooks/usePublicInteractivePrompt';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import styles from './DailyGoalPrompt.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { InteractivePromptRouter } from '../interactive_prompt/components/InteractivePromptRouter';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../shared/images/useOsehImageState';
import { OsehImageFromState } from '../../shared/images/OsehImageFromState';

type DailyGoalPromptProps = {
  /**
   * Called when this component is ready to be displayed, because all
   * the required assets are available.
   */
  onLoaded: () => void;

  /**
   * Called when the user has finished responding to their daily goal.
   *
   * @param answer The answer the user gave to the daily goal, null if they
   *   closed the prompt without answering.
   */
  onFinished: (answer: string | null) => void;
};

/**
 * Prompts the user about what they are trying to accomplish today
 */
export const DailyGoalPrompt = ({ onLoaded, onFinished }: DailyGoalPromptProps): ReactElement => {
  const publicPrompt = usePublicInteractivePrompt({ identifier: 'onboarding-prompt-feeling' });
  const windowSize = useWindowSize();
  const imageHandler = useOsehImageStateRequestHandler({});
  const backgroundImage = useOsehImageState(
    {
      uid: 'oseh_if_0ykGW_WatP5-mh-0HRsrNw',
      jwt: null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
      isPublic: true,
    },
    imageHandler
  );
  const [response, setResponse] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const leavingCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (loaded) {
      return;
    }

    if (publicPrompt.prompt !== null && !backgroundImage.loading) {
      setLoaded(true);
    }
  }, [publicPrompt.prompt, backgroundImage.loading, loaded]);

  useEffect(() => {
    if (loaded) {
      onLoaded();
    }
  }, [loaded, onLoaded]);

  const responseRef = useRef(response);
  responseRef.current = response;
  const handleFinished = useCallback(() => {
    leavingCallback.current?.();
    onFinished(responseRef.current);
  }, [onFinished]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundImageContainer}>
        <OsehImageFromState {...backgroundImage} />
      </div>
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <button type="button" className={styles.close} onClick={handleFinished}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </button>
        </div>
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.content}>
          {publicPrompt.prompt && (
            <InteractivePromptRouter
              prompt={publicPrompt.prompt}
              onFinished={handleFinished}
              onWordPromptResponse={setResponse}
              countdown={undefined}
              subtitle={undefined}
              paused={!loaded}
              leavingCallback={leavingCallback}
              finishEarly
            />
          )}
        </div>
      </div>
    </div>
  );
};

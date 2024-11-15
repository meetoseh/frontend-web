import { ReactElement, useCallback, useContext, useRef } from 'react';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import assistiveStyles from '../../../shared/assistive.module.css';
import styles from './JourneyLobbyScreen.module.css';
import { JourneyPrompt } from '../components/JourneyPrompt';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';

/**
 * Shows the screen for the lobby prior to the actual class, where the user
 * can answer a prompt while they wait. Also useful for hiding the audio loading
 * time, which allows higher quality audio on lower-end devices.
 */
export const JourneyLobbyScreen = ({
  journey,
  shared,
  setScreen,
  onJourneyFinished,
}: JourneyScreenProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const leavingCallback = useRef<(() => void) | null>(null);
  if (leavingCallback.current === undefined) {
    leavingCallback.current = null;
  }

  const gotoStartPrivileged = useCallback(() => {
    if (leavingCallback.current !== null) {
      leavingCallback.current();
    }
    setScreen('start', true);
  }, [setScreen]);

  const gotoStart = useCallback(() => {
    if (leavingCallback.current !== null) {
      leavingCallback.current();
    }
    setScreen('start', false);
  }, [setScreen]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundImageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(shared, (s) => s.darkenedImage)}
        />
      </div>
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <button type="button" className={styles.close} onClick={gotoStartPrivileged}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </button>
        </div>
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.content}>
          <JourneyPrompt
            journey={journey}
            loginContext={loginContextRaw}
            onFinished={gotoStart}
            leavingCallback={leavingCallback}
          />
        </div>
      </div>
    </div>
  );
};

import { ReactElement, useCallback, useContext } from 'react';
import { LoginContext } from '../../../shared/LoginContext';
import { OsehImageFromState } from '../../../shared/OsehImage';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import '../../../assets/fonts.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import styles from './JourneyLobbyScreen.module.css';
import { JourneyPrompt } from '../components/JourneyPrompt';

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
  const loginContext = useContext(LoginContext);
  const gotoStart = useCallback(() => {
    setScreen('start');
  }, [setScreen]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundImageContainer}>
        {shared.image && <OsehImageFromState {...shared.image} />}
      </div>
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <button type="button" className={styles.close} onClick={gotoStart}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </button>
        </div>
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.content}>
          <JourneyPrompt journey={journey} loginContext={loginContext} onFinished={gotoStart} />
        </div>
      </div>
    </div>
  );
};

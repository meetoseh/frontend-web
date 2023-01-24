import { ReactElement, useCallback, useContext, useState } from 'react';
import { ErrorBlock } from '../../shared/forms/ErrorBlock';
import { OsehImageFromState } from '../../shared/OsehImage';
import { JourneyAndJourneyStartShared, JourneyRef } from './JourneyAndJourneyStartShared';
import styles from './JourneyPostScreen.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { LoginContext } from '../../shared/LoginContext';

type JourneyPostScreenProps = {
  /**
   * The journey that was just finished.
   */
  journey: JourneyRef;

  /**
   * The shared information we forward through a journey to prevent refetching
   * the same data.
   */
  shared: JourneyAndJourneyStartShared;

  /**
   * The function to call when the user wants to return to the current daily
   * event screen
   */
  onReturn: (this: void) => void;
};

export const JourneyPostScreen = ({
  journey,
  shared,
  onReturn,
}: JourneyPostScreenProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const error = useState<ReactElement | null>(null)[0];
  const streak = useState<number>(57)[0];
  const [reviewResponse, setReviewResponse] = useState<boolean | null>(null);

  const onReviewUp = useCallback(() => {
    setReviewResponse(true);
  }, []);

  const onReviewDown = useCallback(() => {
    setReviewResponse(false);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...shared.blurredImage!} />
      </div>
      <div className={styles.innerContainer}>
        {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button type="button" className={styles.close} onClick={onReturn}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>

        <div className={styles.primaryContainer}>
          <div className={styles.title}>
            Thanks for practicing
            {loginContext.state === 'logged-in' && loginContext.userAttributes !== null
              ? ' ' + loginContext.userAttributes.givenName
              : ''}
            , you're on a roll
          </div>
          <div className={styles.streak}>
            <div className={styles.streakNumber}>
              {streak.toLocaleString(undefined, { useGrouping: true })}
            </div>
            <div className={styles.streakUnit}>day streak</div>
          </div>
          <div className={styles.reviewContainer}>
            <div className={styles.reviewText}>Do you want to see more classes like this?</div>
            <div className={styles.reviewButtons}>
              <button
                className={`${styles.reviewUp} ${
                  reviewResponse === true ? styles.reviewActive : ''
                }`}
                type="button"
                onClick={onReviewUp}>
                <div className={styles.reviewUpIcon} />
                <div className={assistiveStyles.srOnly}>Yes</div>
              </button>
              <button
                className={`${styles.reviewDown} ${
                  reviewResponse === false ? styles.reviewActive : ''
                }`}
                type="button"
                onClick={onReviewDown}>
                <div className={styles.reviewDownIcon} />
                <div className={assistiveStyles.srOnly}>No</div>
              </button>
            </div>
          </div>
          <div className={styles.buttonContainer}>
            <a className={styles.button} href="/">
              Share this Class
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

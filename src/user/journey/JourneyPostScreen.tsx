import { ReactElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { OsehImageFromState } from '../../shared/OsehImage';
import { JourneyAndJourneyStartShared, JourneyRef } from './JourneyAndJourneyStartShared';
import styles from './JourneyPostScreen.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { LoginContext } from '../../shared/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';

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
   * The function to call when the user wants to go to the share screen for
   * this journey
   */
  onShare: (this: void) => void;

  /**
   * The function to call when the user wants to return to the current daily
   * event screen
   */
  onReturn: (this: void) => void;
};

export const JourneyPostScreen = ({
  journey,
  shared,
  onShare,
  onReturn,
}: JourneyPostScreenProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [error, setError] = useState<ReactElement | null>(null);
  const [streak, setStreak] = useState<number>(-1);
  const [reviewResponse, setReviewResponse] = useState<boolean | null>(null);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    let active = true;
    fetchStreak();
    return () => {
      active = false;
    };

    async function fetchStreak() {
      setError(null);
      try {
        const response = await apiFetch(
          '/api/1/users/me/streak',
          {
            method: 'GET',
          },
          loginContext
        );
        if (!active) {
          return;
        }
        if (!response.ok) {
          throw response;
        }
        const data = await response.json();
        if (!active) {
          return;
        }
        setStreak(data.streak);
      } catch (e) {
        if (!active) {
          return;
        }
        const err = await describeError(e);
        if (!active) {
          return;
        }
        setError(err);
      }
    }
  }, [loginContext]);

  const feedbackHandledFor = useRef<{ uid: string; response: boolean } | null>(null);
  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }
    if (reviewResponse === null) {
      return;
    }
    if (
      feedbackHandledFor.current !== null &&
      feedbackHandledFor.current.uid === journey.uid &&
      feedbackHandledFor.current.response === reviewResponse
    ) {
      return;
    }
    feedbackHandledFor.current = { uid: journey.uid, response: reviewResponse };

    let active = true;
    sendReviewResponse();
    return () => {
      active = false;
    };

    async function sendReviewResponse() {
      setError(null);
      try {
        const response = await apiFetch(
          '/api/1/journeys/feedback',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journey.uid,
              journey_jwt: journey.jwt,
              version: 'oseh_jf-otp_fKWQzTG-JnA',
              response: reviewResponse ? 1 : 2,
              feedback: null,
            }),
          },
          loginContext
        );
        if (!active) {
          return;
        }
        if (!response.ok) {
          throw response;
        }
      } catch (e) {
        if (!active) {
          return;
        }
        const err = await describeError(e);
        if (!active) {
          return;
        }
        setError(err);
      }
    }
  }, [loginContext, reviewResponse, journey.jwt, journey.uid]);

  const onReviewUp = useCallback(() => {
    setReviewResponse(true);
  }, []);

  const onReviewDown = useCallback(() => {
    setReviewResponse(false);
  }, []);

  const doShare = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onShare();
    },
    [onShare]
  );

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
            <button className={styles.button} onClick={doShare} type="button">
              Share this Class
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

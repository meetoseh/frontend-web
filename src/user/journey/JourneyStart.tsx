import { ReactElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { useFullHeight } from '../../shared/hooks/useFullHeight';
import { LoginContext } from '../../shared/LoginContext';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { OsehImageFromState } from '../../shared/OsehImage';
import { InviteFallbackPrompt } from '../referral/InviteFallbackPrompt';
import { getDailyEventInvite } from '../referral/lib/getDailyEventInvite';
import { NewUserDailyEventInvite } from '../referral/models/NewUserDailyEventInvite';
import { JourneyAndJourneyStartShared, JourneyRef } from './JourneyAndJourneyStartShared';
import styles from './JourneyStart.module.css';

type JourneyStartProps = {
  /**
   * The journey the user will be starting
   */
  journey: JourneyRef;

  /**
   * Shared state between us and the journey to reduce the number of
   * redundant requests
   */
  shared: JourneyAndJourneyStartShared;

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
export const JourneyStart = ({ journey, shared, onStart }: JourneyStartProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const [invite, setInvite] = useState<NewUserDailyEventInvite | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  const onSkipClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onStart();
    },
    [onStart]
  );

  const onPracticeWithAFriendClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (loginContext.state !== 'logged-in') {
        setError(<>You can&rsquo;t do that until you&rsquo;ve logged in.</>);
        return;
      }

      setError(null);
      try {
        const invite = await getDailyEventInvite({
          loginContext,
          journeyUid: journey.uid,
        });
        setInvite(invite);
      } catch (e) {
        const err = await describeError(e);
        setError(err);
      }
    },
    [loginContext, journey.uid]
  );

  useEffect(() => {
    if (invite === null) {
      return;
    }

    const shareData = {
      url: invite.url,
      text: `Let's do a ${journey.category.externalName.toLowerCase()} class together on Oseh.`,
    };

    let fallbackShare =
      !invite.isPlusLink ||
      !window.navigator ||
      !window.navigator.share ||
      !window.navigator.canShare ||
      !window.navigator.canShare(shareData);

    if (!fallbackShare) {
      try {
        navigator.share(shareData);
        setInvite(null);
      } catch (e) {
        console.error(e);
        fallbackShare = true;
      }
    }

    if (fallbackShare) {
      const onCancel = () => {
        setInvite(null);
      };
      return addModalWithCallbackToRemove(
        modalContext.setModals,
        <ModalWrapper minimalStyling={true} onClosed={onCancel}>
          <InviteFallbackPrompt
            loginContext={loginContext}
            onCancel={onCancel}
            initialInvite={invite}
          />
        </ModalWrapper>
      );
    }
  }, [invite, journey.category, loginContext, modalContext.setModals]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        {shared.image && <OsehImageFromState {...shared.image} />}
      </div>

      <div className={styles.innerContainer}>
        {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className={styles.content}>
          <div className={styles.practiceWithAFriendContainer}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onPracticeWithAFriendClick}>
              Practice with a Friend
            </button>
          </div>
          <div className={styles.skipForNowContainer}>
            <button type="button" className={styles.button} onClick={onSkipClick}>
              Skip for Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import { ReactElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/forms/Button';
import { describeError, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { LoginContext } from '../../../shared/LoginContext';
import { ModalContext, addModalWithCallbackToRemove } from '../../../shared/ModalContext';
import { ModalWrapper } from '../../../shared/ModalWrapper';
import { OsehImageFromState } from '../../../shared/OsehImage';
import { InviteFallbackPrompt } from '../../referral/InviteFallbackPrompt';
import { getDailyEventInvite } from '../../referral/lib/getDailyEventInvite';
import { NewUserDailyEventInvite } from '../../referral/models/NewUserDailyEventInvite';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import styles from './JourneyStart.module.css';

/**
 * Shows a screen allowing the user to perform an interaction to start the
 * journey, as well as potentially other social actions.
 *
 * This is useful for elevating to a privileged context, which is required
 * for starting the journey audio.
 */
export const JourneyStart = ({
  journey,
  shared,
  setScreen,
  isOnboarding,
}: JourneyScreenProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const [invite, setInvite] = useState<NewUserDailyEventInvite | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  const onSkipClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      shared.audio!.play!();
      setScreen('journey');
    },
    [setScreen, shared.audio]
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
          journeyUid: isOnboarding ? null : journey.uid,
        });
        setInvite(invite);
      } catch (e) {
        const err = await describeError(e);
        setError(err);
      }
    },
    [loginContext, journey.uid, isOnboarding]
  );

  useEffect(() => {
    if (invite === null) {
      return;
    }

    const shareData = {
      url: invite.url,
      text: isOnboarding
        ? "Join Oseh so we can do mindfulness journey's together."
        : `Let's do a ${journey.category.externalName.toLowerCase()} class together on Oseh.`,
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
  }, [invite, journey.category, loginContext, modalContext.setModals, isOnboarding]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        {shared.image && <OsehImageFromState {...shared.image} />}
      </div>

      <div className={styles.innerContainer}>
        {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className={styles.content}>
          <div className={styles.title}>Your Class is Ready</div>
          <div className={styles.skipForNowContainer}>
            <Button type="button" fullWidth={true} onClick={onSkipClick}>
              Let&rsquo;s Go
            </Button>
          </div>
          <div className={styles.practiceWithAFriendContainer}>
            <Button
              type="button"
              variant="link-white"
              fullWidth={true}
              onClick={onPracticeWithAFriendClick}>
              Invite a Friend
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

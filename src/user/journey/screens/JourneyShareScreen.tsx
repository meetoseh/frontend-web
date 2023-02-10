import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import styles from './JourneyShareScreen.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { OsehImage, OsehImageFromState } from '../../../shared/OsehImage';
import { describeError, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { NewUserDailyEventInvite } from '../../referral/models/NewUserDailyEventInvite';
import { getDailyEventInvite } from '../../referral/lib/getDailyEventInvite';
import { LoginContext } from '../../../shared/LoginContext';
import { addModalWithCallbackToRemove, ModalContext } from '../../../shared/ModalContext';
import { ModalWrapper } from '../../../shared/ModalWrapper';
import { InviteFallbackPrompt } from '../../referral/InviteFallbackPrompt';
import { useOsehContent } from '../../../shared/OsehContent';
import { JourneyScreenProps } from '../models/JourneyScreenProps';

export const JourneyShareScreen = ({
  journey,
  shared,
  onJourneyFinished,
}: JourneyScreenProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const shareable = useOsehContent({
    uid: journey.sample?.uid ?? null,
    jwt: journey.sample?.jwt ?? null,
    showAs: 'video',
    presign: false,
  });
  const [error, setError] = useState<ReactElement | null>(null);
  const [invite, setInvite] = useState<NewUserDailyEventInvite | null>(null);
  const [tryInvite, setTryInvite] = useState(false);
  const [nativeShare, setNativeShare] = useState<File | null>(null);

  const doNativeShare = useCallback(async () => {
    if (shareable.webExport === null || journey.sample === null) {
      setError(<>The sample video for this journey is still processing.</>);
      return;
    }

    setError(null);
    try {
      const response = await fetch(shareable.webExport.url, {
        headers: { Authorization: `bearer ${journey.sample.jwt}` },
      });
      if (!response.ok) {
        throw response;
      }

      const blob = await response.blob();
      const file = new File(
        [blob],
        `Oseh_${journey.title.replaceAll(' ', '-')}_${journey.instructor.name.replaceAll(
          ' ',
          '-'
        )}_Sample.mp4`,
        { type: 'video/mp4' }
      );
      setNativeShare(file);
    } catch (e) {
      const err = await describeError(e);
      setError(err);
    }
  }, [shareable.webExport, journey.sample, journey.title, journey.instructor.name]);

  useEffect(() => {
    if (invite !== null) {
      return;
    }
    let active = true;
    fetchInvite();
    return () => {
      active = false;
    };

    async function fetchInvite() {
      setError(null);
      try {
        const invite = await getDailyEventInvite({
          loginContext,
          journeyUid: journey.uid,
        });
        if (!active) {
          return;
        }
        setInvite(invite);
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
  }, [loginContext, invite, journey.uid]);

  const doShareClassLink = useCallback(async () => {
    setTryInvite(true);
  }, []);

  useEffect(() => {
    if (invite === null || !tryInvite) {
      return;
    }

    const shareData = {
      url: invite.url,
      text: `Let's do a ${journey.category.externalName.toLowerCase()} class together on Oseh. ${
        invite.url
      }`,
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
        setTryInvite(false);
      } catch (e) {
        console.error(e);
        fallbackShare = true;
      }
    }

    if (fallbackShare) {
      const onCancel = () => {
        setTryInvite(false);
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
  }, [invite, tryInvite, modalContext.setModals, journey.category.externalName, loginContext]);

  useEffect(() => {
    if (nativeShare === null) {
      return;
    }

    const shareData = {
      files: [nativeShare],
    };

    let fallbackShare =
      !window.navigator ||
      !window.navigator.share ||
      !window.navigator.canShare ||
      !window.navigator.canShare(shareData) ||
      !navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)/i);

    if (!fallbackShare) {
      try {
        navigator.share(shareData);
        setNativeShare(null);
      } catch (e) {
        console.error(e);
        fallbackShare = true;
      }
    }

    if (fallbackShare) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(nativeShare);
      a.download = nativeShare.name;
      a.click();
      setNativeShare(null);
    }
  }, [nativeShare, modalContext.setModals]);

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...shared.blurredImage!} />
      </div>
      <div className={styles.innerContainer}>
        {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button type="button" className={styles.close} onClick={onJourneyFinished}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>

        <div className={styles.primaryContainer}>
          <div className={styles.previewContainer}>
            <div className={styles.previewImageContainer}>
              <OsehImage
                uid={journey.backgroundImage.uid}
                jwt={journey.backgroundImage.jwt}
                displayWidth={270}
                displayHeight={470}
                alt="preview"
              />
            </div>
            <div className={styles.previewHeader}>
              <div className={styles.previewTitle}>{journey.title}</div>
              <div className={styles.previewInstructor}>with {journey.instructor.name}</div>
            </div>
            <div className={styles.soundWaveContainer}>
              <div className={styles.soundWave} />
              <div className={assistiveStyles.srOnly}>Sound wave</div>
            </div>
            <div className={styles.previewFooter}>My daily #oseh</div>
          </div>
          {error && <ErrorBlock>{error}</ErrorBlock>}
          <div className={styles.shareToStoriesContainer}>
            <button
              className={styles.button}
              onClick={doNativeShare}
              type="button"
              disabled={shareable.webExport === null}>
              Share Video
            </button>
          </div>
          <div className={styles.shareClassLinkContainer}>
            <button
              className={styles.secondaryButton}
              onClick={doShareClassLink}
              disabled={invite === null}
              type="button">
              Share Class Link with Friends
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

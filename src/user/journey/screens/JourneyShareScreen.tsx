import { ReactElement, useCallback, useEffect, useState } from 'react';
import styles from './JourneyShareScreen.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { describeError, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import { useOsehContentTarget } from '../../../shared/content/useOsehContentTarget';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';

export const JourneyShareScreen = ({
  journey,
  shared,
  onJourneyFinished,
  isOnboarding,
}: JourneyScreenProps): ReactElement => {
  const shareable = useOsehContentTarget({
    uid: journey.sample?.uid ?? null,
    jwt: journey.sample?.jwt ?? null,
    showAs: 'video',
    presign: false,
  });
  const [error, setError] = useState<ReactElement | null>(null);
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
  }, [nativeShare]);

  const onCloseClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onJourneyFinished(true);
    },
    [onJourneyFinished]
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(shared, (s) => s.blurredImage)}
        />
      </div>
      <div className={styles.innerContainer}>
        {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button type="button" className={styles.close} onClick={onCloseClick}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>

        <div className={styles.primaryContainer}>
          <div className={styles.previewContainer}>
            <div className={styles.previewImageContainer}>
              <OsehImageFromStateValueWithCallbacks
                state={useMappedValueWithCallbacks(shared, (s) => s.originalImage)}
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
        </div>
      </div>
    </div>
  );
};

import { ReactElement, useCallback } from 'react';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { OnboardingVideo } from './OnboardingVideo';
import { useOsehImageStateValueWithCallbacks } from '../../shared/images/useOsehImageStateValueWithCallbacks';
import buttonStyles from '../../shared/buttons.module.css';
import styles from './OnboardingVideoBlock.module.css';
import { OsehImageFromStateValueWithCallbacks } from '../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useListItemExpandModal } from '../lib/useListItemExpandModal';
import { OnboardingVideoDetails } from './OnboardingVideoDetails';
import { setVWC } from '../../shared/lib/setVWC';

type OnboardingVideoBlockProps = {
  /**
   * The onboarding video to display
   */
  onboardingVideo: OnboardingVideo;

  /**
   * Used to update the onboarding video after a confirmation from the server
   */
  setOnboardingVideo: (this: void, onboardingVideo: OnboardingVideo) => void;

  /**
   * The handler for loading images
   */
  imageHandler: OsehImageStateRequestHandler;
};

export const OnboardingVideoBlock = ({
  onboardingVideo,
  setOnboardingVideo,
  imageHandler,
}: OnboardingVideoBlockProps): ReactElement => {
  const coverStateVWC = useOsehImageStateValueWithCallbacks(
    {
      type: 'react-rerender',
      props: {
        uid: onboardingVideo.thumbnailImage.uid,
        jwt: onboardingVideo.thumbnailImage.jwt,
        displayWidth: 180,
        displayHeight: 368,
        alt: '',
      },
    },
    imageHandler
  );

  const expandedVWC = useListItemExpandModal(
    useCallback(
      (saveIfNecessary, editingVWC) => (
        <OnboardingVideoDetails
          onboardingVideo={onboardingVideo}
          setOnboardingVideo={setOnboardingVideo}
          imageHandler={imageHandler}
          editingVWC={editingVWC}
          saveIfNecessaryVWC={saveIfNecessary}
        />
      ),
      [onboardingVideo, setOnboardingVideo, imageHandler]
    )
  );

  return (
    <button
      className={buttonStyles.unstyled}
      onClick={(e) => {
        e.preventDefault();
        setVWC(expandedVWC, true);
      }}>
      <div className={styles.container}>
        <div className={styles.background}>
          <OsehImageFromStateValueWithCallbacks state={coverStateVWC} />
        </div>
        <div className={styles.backgroundOverlay} />
        <div className={styles.foreground}>
          <div className={styles.foregroundInner}>
            <div className={styles.row}>
              <div className={styles.label}>Purpose</div>
              <div className={styles.value}>
                {onboardingVideo.purpose.type} ({onboardingVideo.purpose.voice},{' '}
                {onboardingVideo.purpose.language})
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Active</div>
              <div className={styles.value}>{onboardingVideo.activeAt !== null ? 'Yes' : 'No'}</div>
            </div>
            {!onboardingVideo.visibleInAdmin && (
              <div className={styles.row}>
                <div className={styles.label}>Visible in Admin</div>
                <div className={styles.value}>No</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

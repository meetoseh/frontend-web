import { ReactElement, useMemo } from 'react';
import styles from './LandingPreviewScreen.module.css';
import { OsehImageFromState, OsehImageProps, useOsehImageState } from '../../../shared/OsehImage';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { SplashScreen } from '../../splash/SplashScreen';
import { Button } from '../../../shared/forms/Button';

type LandingPreviewScreenProps = {
  /**
   * The text above the preview
   */
  title?: ReactElement | string;

  /**
   * The handler for when the continue button is clicked, or a string to have
   * the button be an anchor tag going to the specified url.
   */
  onContinue: React.MouseEventHandler<HTMLButtonElement> | string;
};

/**
 * Shows a preview of the apps core functionality.
 */
export const LandingPreviewScreen = ({ title, onContinue }: LandingPreviewScreenProps) => {
  if (title === undefined) {
    title = 'A fresh way to relieve anxiety and elevate your mood.';
  }

  const windowSize = useWindowSize();
  const backgroundSize = useMemo(() => {
    if (windowSize.width >= 633 && windowSize.height >= 390) {
      return { width: 241, height: 391 };
    }

    return {
      width: Math.round(windowSize.width / 1.618),
      height: Math.round(windowSize.height / 1.618),
    };
  }, [windowSize]);
  const backgroundProps = useMemo<OsehImageProps>(
    () => ({
      uid: 'oseh_if_0ykGW_WatP5-mh-0HRsrNw',
      jwt: null,
      displayWidth: backgroundSize.width,
      displayHeight: backgroundSize.height,
      isPublic: true,
      alt: '',
    }),
    [backgroundSize]
  );
  const background = useOsehImageState(backgroundProps);

  if (background.loading) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container} style={windowSize}>
      <div className={styles.imageContainer}>
        <div className={styles.background} style={windowSize} />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.previewContainer} style={backgroundSize}>
          <div className={styles.previewImageContainer}>
            <OsehImageFromState {...background} />
          </div>

          <div className={styles.previewContent}>
            <div className={styles.previewTitle}>How do you want to feel?</div>
            <div className={styles.previewEmotions}>
              {['calm', 'compassionate', 'hopeful', 'positive', 'inspired', 'confident'].map(
                (emotion) => (
                  <div key={emotion} className={styles.emotion}>
                    {emotion}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
        <div className={styles.buttonContainer}>
          <Button type="button" variant="filled-white" onClick={onContinue} fullWidth>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

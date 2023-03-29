import { ReactElement, useMemo } from 'react';
import { Button } from '../../shared/forms/Button';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { combineClasses } from '../../shared/lib/combineClasses';
import { OsehImageFromState, OsehImageProps, useOsehImageState } from '../../shared/OsehImage';
import styles from './OnboardingFinished.module.css';

type OnboardingFinishedProps = {
  /**
   * The function to call to return the user to the home screen.
   */
  onFinished: () => void;
};

/**
 * The screen that is shown when the user has finished the onboarding experience.
 */
export const OnboardingFinished = ({ onFinished }: OnboardingFinishedProps): ReactElement => {
  const windowSize = useWindowSize();
  const backgroundProps = useMemo<OsehImageProps>(
    () => ({
      uid: 'oseh_if_0ykGW_WatP5-mh-0HRsrNw',
      jwt: null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
      isPublic: true,
      placeholderColor: '#223a3e',
    }),
    [windowSize.width, windowSize.height]
  );
  const background = useOsehImageState(backgroundProps);

  const containerStyle = useFullHeightStyle({ windowSize });

  const contentContainerHeight = Math.min(704, windowSize.height);

  // top of first diamond to bottom of last diamond
  const progressSectionsTrueHeight = 63.6396104 + 2 * 114;

  const progressSectionsStartsAt = (contentContainerHeight - progressSectionsTrueHeight) / 2;
  const firstProgressSectionHeight = progressSectionsStartsAt + 63.6396104;

  const firstProgressSectionStyle = useMemo(
    () => ({
      height: `${firstProgressSectionHeight}px`,
    }),
    [firstProgressSectionHeight]
  );

  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.backgroundContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.contentContainer}>
        <div className={styles.progressContainer}>
          <div
            className={combineClasses(styles.progressSection, styles.progressFirstSection)}
            style={firstProgressSectionStyle}>
            <div className={styles.left}>
              <div className={combineClasses(styles.leftLine, styles.leftFirstLine)} />
              <div className={combineClasses(styles.leftIndicator, styles.leftFirstIndicator)} />
            </div>
            <div className={combineClasses(styles.right, styles.firstRight)}>
              Congrats, you just completed your first class
            </div>
          </div>
          <div className={styles.progressSection}>
            <div className={styles.left}>
              <div className={styles.leftLine} />
              <div className={styles.leftIndicator} />
            </div>
            <div className={styles.right}>Come back tomorrow for your personalized class</div>
          </div>
          <div className={styles.progressSection}>
            <div className={styles.left}>
              <div className={styles.leftLine} />
              <div className={styles.leftIndicator} />
            </div>
            <div className={styles.right}>Continue and build a mindfulness habit</div>
          </div>
        </div>
        <div className={styles.continueContainer}>
          <Button type="button" fullWidth variant="filled" onClick={onFinished}>
            Try Another Class
          </Button>
        </div>
      </div>
    </div>
  );
};

import { Button } from '../../../../../shared/forms/Button';
import { OsehImageFromStateValueWithCallbacks } from '../../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { ECPResources } from './ECPResources';
import styles from './ExtendedClassesPackOfferSample.module.css';

/**
 * Offers the user to take a 3-minute class; the first step in the extended
 * classes pack offer experience.
 */
export const ExtendedClassesPackOfferSample = ({
  windowSize,
  resources,
  onNext,
  onNoThanks,
}: {
  windowSize: { width: number; height: number };
  resources: ECPResources;
  onNext: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onNoThanks: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <div className={styles.background} style={windowSize} />
      </div>
      <div className={styles.content}>
        <div className={styles.locator}>
          <div className={styles.locatorDot} />
          <div className={styles.locatorText}>Just for you</div>
        </div>
        <div className={styles.title}>Would you like to try a three minute class?</div>
        <div className={styles.horizontalRule} />
        <div className={styles.info}>
          Explore this new format and feel the impact of longer classes
        </div>
        <div className={styles.contentImageContainer}>
          <OsehImageFromStateValueWithCallbacks state={resources.tallPreview} />
        </div>
        <div className={styles.submitOuterContainer}>
          <div className={styles.submitContainer}>
            <Button type="button" variant="outlined-white" fullWidth onClick={onNext}>
              Try a class
            </Button>
          </div>
          <div className={styles.submitContainer}>
            <Button type="button" variant="link-white" fullWidth onClick={onNoThanks}>
              No Thanks
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

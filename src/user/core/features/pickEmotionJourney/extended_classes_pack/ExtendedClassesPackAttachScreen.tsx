import { Button } from '../../../../../shared/forms/Button';
import { useFullHeightStyle } from '../../../../../shared/hooks/useFullHeight';
import { useWindowSize } from '../../../../../shared/hooks/useWindowSize';
import { OsehImageFromState } from '../../../../../shared/images/OsehImageFromState';
import { useOsehImageState } from '../../../../../shared/images/useOsehImageState';
import { useOsehImageStateRequestHandler } from '../../../../../shared/images/useOsehImageStateRequestHandler';
import styles from './ExtendedClassesPackAttachScreen.module.css';

/**
 * The screen users see after they purchase the extended classes pack.
 */
export const ExtendedClassesPackAttachScreen = ({ session }: { session: string | null }) => {
  const images = useOsehImageStateRequestHandler({});
  const windowSize = useWindowSize();
  const background = useOsehImageState(
    {
      uid: 'oseh_if_0ykGW_WatP5-mh-0HRsrNw',
      jwt: null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      isPublic: true,
      alt: '',
      placeholderColor: '#01181e',
    },
    images
  );
  const fullHeightStyle = useFullHeightStyle({ attribute: 'minHeight', windowSize });

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.innerContainer} style={fullHeightStyle}>
        <div className={styles.content}>
          <div className={styles.brandmarkContainer}>
            <div className={styles.brandmarkIcon} />
          </div>
          <div className={styles.title}>Thank you</div>
          <div className={styles.subtitle}>
            For being an early supporter and purchasing the <em>Extended Classes Pack</em>.
          </div>
          <div className={styles.description}>
            <p>
              You can view your purchases from your &lsquo;favorites&rsquo;, accessible from the
              Home Screen.
            </p>
          </div>
          <div className={styles.gotoFavoritesButton}>
            <Button type="button" variant="filled-white" onClick="/favorites?tab=courses" fullWidth>
              Go to my purchases
            </Button>
          </div>
          {session !== null && (
            <div className={styles.transactionNumber}>
              <div className={styles.transactionNumberLabel}>Confirmation Code</div>
              <div className={styles.transactionNumberValue}>{session}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

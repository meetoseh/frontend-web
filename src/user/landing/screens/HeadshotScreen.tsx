import { ReactElement, useMemo } from 'react';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { OsehImageFromState, OsehImageProps, useOsehImageState } from '../../../shared/OsehImage';
import styles from './HeadshotScreen.module.css';
import { Button } from '../../../shared/forms/Button';

type HeadshotScreenProps = {
  /**
   * The UID for the public image file for the headshot, defaults to
   * oseh_if_y2J1TPz5VhUUsk8I0ofPwg
   */
  headshotUid?: string;

  /**
   * The quote for the user. Not surrounded in quotes, so you can add your own.
   * Defaults to
   * "I feel like I have a better understanding of my anxiety and how to manage it."
   */
  quote?: ReactElement | string;
  /**
   * The name of the user. Defaults to "Jane Smith"
   */
  name?: ReactElement | string;
  /**
   * The handler for when the continue button is clicked, or a string to have
   * the button be an anchor tag going to the specified url.
   */
  onContinue: React.MouseEventHandler<HTMLButtonElement> | string;
};

export const HeadshotScreen = ({
  headshotUid: headshotUidRaw,
  quote: quoteRaw,
  name: nameRaw,
  onContinue,
}: HeadshotScreenProps): ReactElement => {
  const headshotUid = headshotUidRaw ?? 'oseh_if_y2J1TPz5VhUUsk8I0ofPwg';
  const quote = quoteRaw ?? (
    <>I feel like I have a better understanding of my anxiety and how to manage it.</>
  );
  const name = nameRaw ?? <>Jane Smith</>;

  const windowSize = useWindowSize();
  const backgroundProps = useMemo<OsehImageProps>(
    () => ({
      uid: 'oseh_if_hH68hcmVBYHanoivLMgstg',
      jwt: null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
      isPublic: true,
      placeholderColor: '#021a1e',
    }),
    [windowSize]
  );
  const background = useOsehImageState(backgroundProps);

  const headshotProps = useMemo<OsehImageProps>(
    () => ({
      uid: headshotUid,
      jwt: null,
      displayWidth: 189,
      displayHeight: 189,
      alt: '',
      isPublic: true,
      placeholderColor: '#f9f9f9',
    }),
    [headshotUid]
  );
  const headshot = useOsehImageState(headshotProps);

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.content}>
        <div className={styles.headshot}>
          <OsehImageFromState {...headshot} />
        </div>
        <div className={styles.quote}>{quote}</div>
        <div className={styles.name}>{name}</div>
        <div className={styles.buttonContainer}>
          <Button type="button" variant="filled-white" onClick={onContinue} fullWidth>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

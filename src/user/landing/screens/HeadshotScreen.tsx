import { ReactElement } from 'react';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import styles from './HeadshotScreen.module.css';
import { SplashScreen } from '../../splash/SplashScreen';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../shared/images/useOsehImageState';
import { OsehImageFromState } from '../../../shared/images/OsehImageFromState';
import { useOauthProviderUrlsValueWithCallbacks } from '../../login/hooks/useOauthProviderUrlsValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { ProvidersList } from '../../core/features/login/components/ProvidersList';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';

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
   * A value prop above the signin buttons, defaults to
   * "Free access to anxiety-relieving 1 minute exercises"
   */
  valueProp?: ReactElement | string;
};

/**
 * A screen which shows the oseh logo, a user headshot & quote, a sentence,
 * and login buttons.
 */
export const HeadshotScreen = ({
  headshotUid: headshotUidRaw,
  quote: quoteRaw,
  name: nameRaw,
  valueProp: valuePropRaw,
}: HeadshotScreenProps): ReactElement => {
  const headshotUid = headshotUidRaw ?? 'oseh_if_y2J1TPz5VhUUsk8I0ofPwg';
  const quote = quoteRaw ?? (
    <>I feel like I have a better understanding of my anxiety and how to manage it.</>
  );
  const name = nameRaw ?? <>Jane Smith</>;
  const valueProp = valuePropRaw ?? <>Free access to anxiety-relieving 1 minute exercises</>;
  const urls = useOauthProviderUrlsValueWithCallbacks(
    useWritableValueWithCallbacks(() => ['Google', 'SignInWithApple', 'Direct'])
  );

  const windowSize = useWindowSize();
  const imageHandler = useOsehImageStateRequestHandler({});
  const background = useOsehImageState(
    {
      uid: 'oseh_if_hH68hcmVBYHanoivLMgstg',
      jwt: null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
      isPublic: true,
      placeholderColor: '#021a1e',
    },
    imageHandler
  );
  const headshot = useOsehImageState(
    {
      uid: headshotUid,
      jwt: null,
      displayWidth: 56,
      displayHeight: 56,
      alt: '',
      isPublic: true,
      placeholderColor: '#f9f9f9',
    },
    imageHandler
  );

  if (urls === null || headshot.loading) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.content}>
        <div className={styles.userQuote}>
          <div className={styles.headshot}>
            <OsehImageFromState {...headshot} />
          </div>
          <div className={styles.quote}>{quote}</div>
          <div className={styles.name}>{name}</div>
        </div>
        <div className={styles.valueProp}>{valueProp}</div>
        <div className={styles.buttonsContainer}>
          <RenderGuardedComponent
            props={urls[0]}
            component={(items) => <ProvidersList items={items} />}
          />
        </div>
      </div>
    </div>
  );
};

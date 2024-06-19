import { ReactElement } from 'react';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import styles from './HeadshotScreen.module.css';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOauthProviderUrlsValueWithCallbacks } from '../../login/hooks/useOauthProviderUrlsValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { ProvidersList } from '../../login/components/ProvidersList';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';

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

  /** The image handler to use */
  imageHandler: OsehImageStateRequestHandler;
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
  imageHandler,
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
  const backgroundVWC = useOsehImageStateValueWithCallbacks(
    {
      type: 'react-rerender',
      props: {
        uid: 'oseh_if_NOA1u2xYanYQlA8rdpPEQQ',
        jwt: null,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
        isPublic: true,
        placeholderColor: '#040b17',
      },
    },
    imageHandler
  );
  const headshotVWC = useOsehImageStateValueWithCallbacks(
    {
      type: 'react-rerender',
      props: {
        uid: headshotUid,
        jwt: null,
        displayWidth: 56,
        displayHeight: 56,
        alt: '',
        isPublic: true,
        placeholderColor: '#f9f9f9',
      },
    },
    imageHandler
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks state={backgroundVWC} />
      </div>
      <div className={styles.content}>
        <div className={styles.userQuote}>
          <div className={styles.headshot}>
            <OsehImageFromStateValueWithCallbacks state={headshotVWC} />
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

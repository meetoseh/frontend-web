import { ReactElement, useContext, useRef } from 'react';
import styles from './LoginApp.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { SplashScreen } from '../splash/SplashScreen';
import { useWindowSizeValueWithCallbacks } from '../../shared/hooks/useWindowSize';
import { OsehImage } from '../../shared/images/OsehImage';
import { InterestsContext } from '../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { ProvidersList } from '../core/features/login/components/ProvidersList';
import { useFullHeight } from '../../shared/hooks/useFullHeight';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { OauthProvider } from './lib/OauthProvider';
import { useOauthProviderUrlsValueWithCallbacks } from './hooks/useOauthProviderUrlsValueWithCallbacks';

/**
 * This allows users to sign up or sign in via social logins. It does not
 * use the login context; it will redirect back to the home page with the
 * required tokens in the url fragment on success.
 */
export const LoginApp = (): ReactElement => {
  const interests = useContext(InterestsContext);
  const componentRef = useRef<HTMLDivElement | null>(null);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const providers = useWritableValueWithCallbacks<OauthProvider[]>(() => [
    'Google',
    'SignInWithApple',
    'Direct',
  ]);
  const [urls, urlsError] = useOauthProviderUrlsValueWithCallbacks(providers);
  const imageHandler = useOsehImageStateRequestHandler({});
  useFullHeight({ element: componentRef, attribute: 'minHeight', windowSizeVWC });

  const modalContext = useContext(ModalContext);
  useErrorModal(modalContext.modals, error, 'direct account login');
  useErrorModal(modalContext.modals, urlsError, 'oauth provider urls');

  if (urls === null) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <RenderGuardedComponent
          props={windowSizeVWC}
          component={(windowSize) => (
            <OsehImage
              uid="oseh_if_NOA1u2xYanYQlA8rdpPEQQ"
              jwt={null}
              displayWidth={windowSize.width}
              displayHeight={windowSize.height}
              alt=""
              isPublic={true}
              handler={imageHandler}
              placeholderColor={windowSize.width < 450 ? '#aaaaaa' : '#011419'}
            />
          )}
        />
      </div>
      <div className={styles.innerContainer} ref={componentRef}>
        <div className={styles.primaryContainer}>
          <div className={styles.logoAndInfoContainer}>
            <div className={styles.logoContainer}>
              <div className={styles.logo} />
              <div className={assistiveStyles.srOnly}>Oseh</div>
            </div>
            <div className={styles.info}>
              {(() => {
                const defaultCopy = <>A better day is 60 seconds away.</>;
                if (interests.state !== 'loaded') {
                  return defaultCopy;
                } else if (interests.primaryInterest === 'anxiety') {
                  return <>Sign up for instant, free access to anxiety-relieving meditations.</>;
                } else if (interests.primaryInterest === 'mindful') {
                  return (
                    <>
                      You&rsquo;re one step away from starting a life-changing mindfulness journey
                    </>
                  );
                } else if (interests.primaryInterest === 'sleep') {
                  return (
                    <>
                      Sign up for instant, free access to sleep-inducing meditations from the
                      world&rsquo;s most relaxing instructors.
                    </>
                  );
                } else {
                  return defaultCopy;
                }
              })()}
            </div>
          </div>
          <RenderGuardedComponent
            props={urls}
            component={(items) => <ProvidersList items={items} />}
          />
        </div>
      </div>
    </div>
  );
};

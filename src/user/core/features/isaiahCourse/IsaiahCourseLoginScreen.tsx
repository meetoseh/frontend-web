import { ReactElement, useEffect } from 'react';
import styles from './IsaiahCourseLoginScreen.module.css';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { SplashScreen } from '../../../splash/SplashScreen';
import { useUnwrappedValueWithCallbacks } from '../../../../shared/hooks/useUnwrappedValueWithCallbacks';
import { getUTMFromURL } from '../../../../shared/hooks/useVisitorValueWithCallbacks';
import { useStaleOsehImageOnSwap } from '../../../../shared/images/useStaleOsehImageOnSwap';
import { useOauthProviderUrlsValueWithCallbacks } from '../../../login/hooks/useOauthProviderUrlsValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OauthProvider } from '../../../login/lib/OauthProvider';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { ProvidersList } from '../login/components/ProvidersList';

const backgroundUid = 'oseh_if_sqEZCjA1sP6vaIrzz5Lvsw';

/**
 * The login screen used for a user that's coming for isaiah's affirmation course.
 */
export const IsaiahCourseLoginScreen = (): ReactElement => {
  const imageHandler = useOsehImageStateRequestHandler({});
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const backgroundVWC = useStaleOsehImageOnSwap(
    useOsehImageStateValueWithCallbacks(
      adaptValueWithCallbacksAsVariableStrategyProps(
        useMappedValueWithCallbacks(windowSizeVWC, (windowSize) => ({
          uid: backgroundUid,
          jwt: null,
          displayWidth: windowSize.width,
          displayHeight: windowSize.height,
          isPublic: true,
          alt: '',
        }))
      ),
      imageHandler
    )
  );
  const urls = useOauthProviderUrlsValueWithCallbacks(
    useWritableValueWithCallbacks<OauthProvider[]>(() => ['Google', 'SignInWithApple', 'Direct'])
  );
  const backgroundLoading = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(backgroundVWC, (b) => b.loading)
  );

  useEffect(() => {
    const utm = getUTMFromURL();
    let courseSlug: string | null = null;
    if (utm !== null && utm.campaign === 'course') {
      if (utm.content === 'affirmation-course') {
        courseSlug = 'resilient-spirit-07202023';
      } else if (utm.content === 'elevate-within') {
        courseSlug = 'elevate-within-080882023';
      }
    }

    if (courseSlug !== null) {
      localStorage.setItem('lastIsaiahCourseSlug', courseSlug);
    }
  }, []);

  if (urls === null || backgroundLoading) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks state={backgroundVWC} />
        <div className={styles.topGradient} />
        <div className={styles.bottomGradient} />
      </div>
      <div className={styles.content}>
        <div className={styles.logoAndInfoContainer}>
          <div className={styles.logoContainer}>
            <div className={styles.logo} />
            <div className={assistiveStyles.srOnly}>Oseh</div>
          </div>
          <div className={styles.info}>
            High-five on your new Isaiah Quinn course. Login below to get started.
          </div>
        </div>
        <RenderGuardedComponent
          props={urls[0]}
          component={(items) => <ProvidersList items={items} />}
        />
      </div>
    </div>
  );
};
